/* Opens the dashboard in a tab when the toolbar button is clicked. */
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
