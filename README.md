# Huawei router dashboard

Shows what your Huawei 4G/5G router is doing — connection, signal, data used,
connected devices, unread messages, and the cells it is using — and lets you
turn Wi-Fi or mobile data on and off, reconnect, or restart it.

## Run it

1. Double-click **`Start Dashboard.bat`**.
2. Your browser opens on the dashboard.
3. Type your router's admin password and press **Connect**.

Keep the black window open while you use the dashboard; closing it stops the
dashboard.

The router address is filled in already. If your router is somewhere else, type
its address instead — usually `http://192.168.8.1` or `http://192.168.1.1`.

Tick **Remember on this computer** to stay signed in next time. Press **Forget
password** to remove it.

## What you need

- Windows
- Node.js — if it is missing, the launcher opens the download page and waits;
  install it, then double-click the launcher again
- A Huawei router on the same network
- Any browser

## If it does not work

- **It says the password is wrong.** Use the same username and password you use
  on the router's own page. After a few failed attempts the router blocks
  sign-in for a few minutes.
- **It says the port is already in use.** The dashboard is already running in
  another window. Use that one, or close it and start again.
- **The Cells tab is empty.** Cells need you to be signed in. Sign in on the
  Overview tab first.
- **A value shows as a dash.** That router model does not report it; everything
  else still works.

## A note on what it stores

Your router password stays in the browser on this computer, and only when
**Remember on this computer** is ticked. **Forget password** removes it. The
dashboard talks to your router and to nothing else.

---

## بالعربية

تعرض هذه اللوحة حال اتصال راوترك، وقوة الإشارة، وحجم ما استهلكه من بيانات،
والأجهزة المتصلة به، وعدد الرسائل غير المقروءة، والخلايا التي يعمل عليها.
وتُمكّنك من تشغيل الواي فاي وإيقافه، وتشغيل بيانات الجوّال وإيقافها، وإعادة
الاتصال، وإعادة تشغيل الراوتر.

### التشغيل

1. انقر مرتين على الملف **`Start Dashboard.bat`**.
2. ينفتح متصفحك على اللوحة.
3. اكتب كلمة مرور مدير الراوتر، ثم اضغط **Connect**.

أبقِ النافذة السوداء مفتوحة ما دمت تستعمل اللوحة، فإغلاقها يوقفها.

عنوان الراوتر مكتوب سالفاً. وإن كان راوترك في عنوان آخر فاكتبه مكانه، وهو في
الغالب `http://192.168.8.1` أو `http://192.168.1.1`.

أبقِ خيار **Remember on this computer** مؤشراً لتبقى داخلاً في المرة القادمة،
واضغط **Forget password** لمحو الكلمة.

### ما تحتاجه

- حاسوب يعمل بنظام ويندوز.
- برنامج Node.js، وإن لم يكن مثبتاً فسيفتح المشغّل صفحة تنزيله وينتظرك؛ ثبّته
  ثم انقر على المشغّل مرة أخرى.
- راوتر هواوي على الشبكة نفسها.
- أي متصفح.

### إن لم يعمل

- **قال إن كلمة المرور خاطئة:** استعمل اسم المستخدم وكلمة المرور نفسيهما اللذين
  تدخل بهما إلى صفحة الراوتر. وإن أخطأت مرات عدة منع الراوتر الدخول دقائق.
- **قال إن المنفذ مشغول:** اللوحة تعمل في نافذة أخرى، فاستعملها أو أغلقها ثم
  ابدأ من جديد.
- **تبويب Cells فارغ:** يحتاج إلى دخولك، فادخل من تبويب Overview ثم ارجع إليه.
- **ظهرت شرطة مكان قيمة:** هذا الطراز لا يبلّغ عنها، ويعمل ما سواها.

### عن كلمة المرور

تبقى كلمة مرور راوترك في متصفحك على هذا الحاسوب، ولا تُحفظ إلا إذا أبقيت خيار
**Remember on this computer** مؤشراً، ويمحوها زر **Forget password**. ولا تتصل
اللوحة إلا براوترك.
