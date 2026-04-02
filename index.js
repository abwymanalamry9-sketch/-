const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// 🔹 التحقق من متغير البيئة قبل التحويل
if (!process.env.FIREBASE_KEY) {
  console.error("❌ متغير البيئة FIREBASE_KEY غير موجود!");
  process.exit(1); // إيقاف السيرفر إذا المفتاح غير موجود
}

// قراءة مفتاح Firebase من Environment Variable مع إصلاح newline
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_KEY.replace(/\\n/g, '\n'));
} catch (err) {
  console.error("❌ خطأ في JSON لمفتاح Firebase:", err);
  process.exit(1);
}

// تهيئة Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Endpoint لإرسال الرسائل
app.post("/send-message", async (req, res) => {
  try {
    const { senderName, receiverId, text } = req.body;

    if (!senderName || !receiverId || !text) {
      return res.status(400).send("الرجاء إرسال جميع الحقول: senderName, receiverId, text");
    }

    // حفظ الرسالة في Firestore
    await db.collection("messages").add({
      senderName,
      receiverId,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // جلب توكن المستلم
    const userDoc = await db.collection("المستخدمون").doc(receiverId).get();
    if (!userDoc.exists) {
      return res.status(404).send("المستخدم غير موجود");
    }

    const userData = userDoc.data();
    const token = userData?.fcmToken;

    if (!token) {
      return res.send("تم حفظ الرسالة لكن لا يوجد توكن FCM");
    }

    // إرسال إشعار FCM
    await admin.messaging().send({
      token: token,
      notification: {
        title: senderName,
        body: text,
      },
      data: { senderName, text },
    });

    res.send("تم إرسال الرسالة والإشعار ✅");

  } catch (error) {
    console.error("خطأ أثناء إرسال الرسالة:", error);
    res.status(500).send("خطأ في السيرفر");
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
