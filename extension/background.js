// Background service worker — handle icon click to open gallery in new tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("gallery.html") });
});
