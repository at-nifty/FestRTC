document.addEventListener('DOMContentLoaded', () => {
  const openControllerButton = document.getElementById('openController');
  const openMonitorButton = document.getElementById('openMonitor');

  openControllerButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("controller.html") });
  });

  openMonitorButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("monitor.html") });
  });
});