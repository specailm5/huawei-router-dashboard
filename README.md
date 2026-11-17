# Huawei router dashboard

Shows what your Huawei 4G/5G router is doing — connection, signal, data used,
connected devices, unread messages, and the cells it is using — and lets you
turn Wi-Fi or mobile data on and off, reconnect, or restart it.

## Run it

1. Double-click **`Start Dashboard (Extension).bat`**.
2. A browser window opens on the dashboard.
3. Type your router's admin password and press **Connect**.

The router address is filled in already. If your router is somewhere else, type
its address instead — usually `http://192.168.8.1` or `http://192.168.1.1`.

Tick **Remember on this computer** to stay signed in next time. Press **Forget
password** to remove it.

## What you need

- Windows
- A Huawei router connected to the same network
- Microsoft Edge, Google Chrome, Brave, Vivaldi or Helium — Edge comes with
  Windows, so there is usually nothing to install

## If it does not work

- **No window opens.** The message will say whether a browser or the dashboard
  files are missing. Keep the launcher in the same folder as `extension`.
- **It says the password is wrong.** Use the same username and password you use
  to log in to the router's own page. If you have failed a few times, the router
  blocks sign-in for a few minutes.
- **The Cells tab is empty.** Cells need you to be signed in. Sign in on the
  Overview tab first.
- **A value shows as a dash.** That router model does not report it; everything
  else still works.

## A note on what it stores

Your router password stays on this computer. It is kept by the browser only when
**Remember on this computer** is ticked, and **Forget password** removes it. The
dashboard talks to your router and to nothing else.
