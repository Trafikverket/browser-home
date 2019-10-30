const { fetchFaviconUrl } = require('./fetchFaviconUrl')
const { getFaviconContent } = require('./getFaviconContent')

const STORE_VERSION = 1

async function shouldRefreshStore() {

  const store = await browser.storage.local.get('store_version')
  const version = store.store_version || 0

  if (version < STORE_VERSION) {

    await browser.storage.local.set({ store_version: STORE_VERSION })
    return true
  }

  return false
}

async function updateFavicon({ id, url }) {

  const faviconUrl = await fetchFaviconUrl(url, true, { fetch, DOMParser })
  const faviconContent = await getFaviconContent(faviconUrl)

  await browser.storage.local.set({
    [`favicon_content_${id}`]: faviconContent,
  })
}

function searchBookmarksTreeForId(tree, bookmarkId) {

  for (const bookmark of tree) {

    let searchResult

    if (bookmark.type === 'folder') {
      searchResult = searchBookmarksTreeForId(bookmark.children, bookmarkId)
    } else {
      searchResult = bookmark.id === bookmarkId
    }

    if (searchResult === true) {
      return true
    }
  }

  return false
}

async function isBookmarkInStartpageFolder(bookmarkFolderId, bookmarkId) {

  const tree = await browser.bookmarks.getSubTree(bookmarkFolderId)
  return searchBookmarksTreeForId(tree[0].children, bookmarkId)
}

async function handleUpdatedBookmark(bookmarkFolderId, bookmarkId) {

  if (!isBookmarkInStartpageFolder(bookmarkFolderId, bookmarkId)) {
    return
  }

  const [bookmark] = await browser.bookmarks.get(bookmarkId)
  updateFavicon(bookmark)
}

async function handleUpdatedBookmarkFolder(bookmarkFolderId) {

  const tree = await browser.bookmarks.getSubTree(bookmarkFolderId)
  const bookmarks = transformBookmarkTreeToBookmarkList(tree[0])

  await Promise.all(bookmarks.map((bookmark) => updateFavicon(bookmark)))
}

function transformBookmarkTreeToBookmarkList(folder) {

  if (folder.children.length > 0) {

    return folder.children.reduce((acc, child) => {

      if (child.type === 'folder') {
        return [...acc, ...transformBookmarkTreeToBookmarkList(child)]
      }

      return [...acc, child]
    }, [])
  }

  return []
}

async function createBookmarkFolder() {

  const folder = await browser.bookmarks.create({
    title: 'Favorites',
    type: 'folder',
  })

  await browser.storage.local.set({ bookmarkFolderId: folder.id })

  return folder.id
}

async function createBookmarkFolderIfNotExists() {

  const { bookmarkFolderId } = await browser.storage.local.get('bookmarkFolderId')

  if (!bookmarkFolderId) {
    return createBookmarkFolder()
  }

  // Check if bookmark folder still exists
  try {
    await browser.bookmarks.get(bookmarkFolderId)
  } catch (err) {
    return createBookmarkFolder()
  }

  return bookmarkFolderId
}

async function init() {

  const bookmarkFolderId = await createBookmarkFolderIfNotExists()

  const listener = handleUpdatedBookmark.bind(null, bookmarkFolderId)
  browser.bookmarks.onCreated.addListener(listener)
  browser.bookmarks.onMoved.addListener(listener)

  browser.storage.onChanged.addListener((param) => {

    if ('bookmarkFolderId' in param) {
      handleUpdatedBookmarkFolder(param.bookmarkFolderId.newValue)
    }
  })

  const refreshStore = await shouldRefreshStore()
  if (refreshStore) {
    console.log('Trigger new store refresh')
    handleUpdatedBookmarkFolder(bookmarkFolderId)
  }

  console.log('Extension is loaded')
}

init()
