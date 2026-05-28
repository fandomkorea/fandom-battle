const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onValueCreated } = require('firebase-functions/v2/database');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp({
  databaseURL: 'https://fandom-battle-92aa8-default-rtdb.firebaseio.com'
});
const db = admin.database();

const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');

/**
 * Cloudinary 이미지 삭제 — 게시글 삭제 시 프론트에서 호출
 */
exports.deleteCloudinaryImage = onCall(
  { secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET] },
  async (request) => {
    const { publicId } = request.data;

    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    if (!publicId) {
      throw new HttpsError('invalid-argument', 'publicId가 필요합니다.');
    }

    try {
      const cloudinaryCloudName = 'dhkgabcme';
      const apiKey = CLOUDINARY_API_KEY.value();
      const apiSecret = CLOUDINARY_API_SECRET.value();
      const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`,
        { public_id: publicId, api_key: apiKey },
        { headers: { Authorization: `Basic ${authString}` } }
      );

      console.log(`✅ Cloudinary 이미지 삭제 완료: ${publicId}`);
      return { success: true, publicId, result: response.data.result };
    } catch (error) {
      console.error('❌ Cloudinary 이미지 삭제 실패:', error.message);
      if (error.response?.data?.error?.message?.includes('not found')) {
        return { success: true, message: '이미지가 이미 삭제되었거나 존재하지 않습니다.' };
      }
      throw new HttpsError('internal', `Cloudinary 삭제 실패: ${error.message}`);
    }
  }
);

/**
 * 댓글 작성 시 게시글 작성자에게 FCM 푸시 알림 전송
 */
exports.sendCommentNotification = onValueCreated(
  '/community/{fandom}/{postId}/comments/{commentId}',
  async (event) => {
    const comment = event.data.val();
    const { fandom, postId } = event.params;

    if (!comment || !comment.authorUid) return null;

    const postSnap = await db.ref(`/community/${fandom}/${postId}`).once('value');
    const post = postSnap.val();
    if (!post || !post.authorUid) return null;

    // 자기 글에 자기 댓글이면 알림 없음
    if (comment.authorUid === post.authorUid) return null;

    const tokenSnap = await db.ref(`/users/${post.authorUid}/fcmToken`).once('value');
    const fcmToken = tokenSnap.val();
    if (!fcmToken) return null;

    const commenterName = comment.authorNickname || '누군가';
    const commentText = (comment.content || '').replace(/<[^>]+>/g, '');
    const shortContent = commentText.length > 60
      ? commentText.substring(0, 60) + '...'
      : commentText || '(댓글 내용 없음)';

    const message = {
      token: fcmToken,
      notification: {
        title: `${commenterName}님이 댓글을 달았어요 💬`,
        body: shortContent,
      },
      webpush: {
        notification: {
          icon: 'https://fandomkorea.github.io/fandom-battle/og-image.png',
        },
        fcmOptions: {
          link: 'https://fandomkorea.github.io/fandom-battle/'
        }
      }
    };

    try {
      await admin.messaging().send(message);
      console.log(`✅ 댓글 알림 발송: uid=${post.authorUid}`);
    } catch (error) {
      if (error.code === 'messaging/registration-token-not-registered') {
        await db.ref(`/users/${post.authorUid}/fcmToken`).remove();
        console.log(`🗑️ 만료된 FCM 토큰 삭제: uid=${post.authorUid}`);
      } else {
        console.error('❌ 댓글 알림 발송 실패:', error.message);
      }
    }

    return null;
  }
);
