const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

// قراءة مفتاح Firebase من Environment Variable
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Endpoint لإرسال الرسائل
app.post("/send-message", async (req, res) => {
  try {
    const { senderName, receiverId, text } = req.body;

    const messageRef = await db.collection("messages").add({
      senderName,
      receiverId,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const userDoc = await db.collection("المستخدمون").doc(receiverId).get();

    if (!userDoc.exists) {
      return res.status(404).send("المستخدم غير موجود");
    }

    const userData = userDoc.data();
    const token = userData.fcmToken;

    if (!token) {
      return res.send("تم حفظ الرسالة لكن لا يوجد توكن");
    }

    await admin.messaging().send({
      token: token,
      notification: {
        title: senderName,
        body: text,
      },
      data: {
        senderName,
        text,
      },
    });

    res.send("تم إرسال الرسالة والإشعار ✅");

  } catch (error) {
    console.error(error);
    res.status(500).send("خطأ في السيرفر");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
