import * as mockedData from './mockedData'

function isBrowser() {
  return typeof browser !== 'undefined'
}

export function onBookmarkUpdate(listener) {

  if (!isBrowser()) {
    return
  }

  browser.bookmarks.onCreated.addListener(listener)
  browser.bookmarks.onMoved.addListener(listener)
  browser.bookmarks.onRemoved.addListener(listener)
}

export function onStoreUpdate(listener) {

  if (!isBrowser()) {
    return
  }

  browser.storage.onChanged.addListener(listener)
}

export async function getBookmarks(bookmarkFolderId) {

  if (isBrowser()) {
    const tree = await browser.bookmarks.getSubTree(bookmarkFolderId)
    return tree[0]
  }

  return mockedData.bookmarks[0]
}

function filterFolders(tree) {

  const children = tree.children
    .filter((child) => child.type === 'folder')
    .map((child) => filterFolders(child))

  return { ...tree, children }
}

export async function getAllBookmarkFolders() {

  if (isBrowser()) {
    const tree = await browser.bookmarks.getTree()
    return filterFolders(tree[0])
  }

  return filterFolders(mockedData.rootBookmarks[0])
}

export function storage() {

  if (isBrowser()) {
    return browser.storage.local
  }

  return {
    get: (key) => {

      if (key === undefined) {
        return mockedData.store
      }

      const keys = Array.isArray(key) ? key : [key]

      return keys.reduce((acc, id) => ({ ...acc, [id]: mockedData.store[id] }), {})
    },
    set: () => {},
  }
}

export async function getStoreValue(key) {
  const obj = await storage().get(key)
  return obj[key]
}

export function setStoreValue(key, value) {
  return storage().set({ [key]: value })
}
