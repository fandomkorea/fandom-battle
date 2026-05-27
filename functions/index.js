const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

// Firebase 초기화
admin.initializeApp({
  databaseURL: 'https://fandom-battle-92aa8-default-rtdb.firebaseio.com'
});
const db = admin.database();

// ── TNK Factory 광고 보상 콜백 ──
exports.tnkCallback = functions.https.onRequest(async (req, res) => {
  const { seq_id, pay_pnt, md_user_nm, md_chk } = req.body;

  // 1. 필수 파라미터 확인
  if (!seq_id || !md_user_nm || !md_chk) {
    console.error('❌ 필수 파라미터 누락:', { seq_id, md_user_nm, md_chk });
    return res.status(400).send('FAIL');
  }

  // 2. 보안 검증 (md_chk = MD5(app_key + md_user_nm + seq_id))
  const APP_KEY = '8dbe1a90b25070c8b1f27eab9e5ae495'; // TNK App Key
  const expected = crypto
    .createHash('md5')
    .update(APP_KEY + md_user_nm + seq_id)
    .digest('hex');

  if (expected !== md_chk) {
    console.error('❌ 보안 검증 실패:', { expected, received: md_chk });
    return res.status(400).send('INVALID');
  }

  try {
    // 3. 중복 지급 방지 (seq_id로 체크)
    const seqRef = db.ref(`tnk_seq/${seq_id}`);
    const seqSnap = await seqRef.once('value');
    if (seqSnap.exists()) {
      console.log('⚠️ 중복 요청 무시:', seq_id);
      return res.status(200).send('OK'); // 이미 처리됨
    }

    // 4. Firebase DB에 투표권 + 광고 시청 횟수 지급
    const uid = md_user_nm; // Firebase UID
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    await Promise.all([
      // 투표권 +1
      db.ref(`users/${uid}/pendingAdVotes`)
        .transaction(current => (current || 0) + 1),
      // 오늘 광고 시청 횟수 +1
      db.ref(`users/${uid}/ad_watch_count_${today}`)
        .transaction(current => (current || 0) + 1)
    ]);

    // 5. 중복 방지용 seq_id 기록
    await seqRef.set({ timestamp: Date.now(), uid, pay_pnt: pay_pnt || 0 });

    console.log(`✅ TNK 투표권 지급 완료: uid=${uid}, seq_id=${seq_id}, points=${pay_pnt}`);
    return res.status(200).send('OK');

  } catch (error) {
    console.error('❌ TNK 콜백 처리 실패:', error);
    return res.status(500).send('ERROR');
  }
});

/**
 * Cloudinary 이미지 삭제 Cloud Function
 * 게시물 삭제 시 호출되어 Cloudinary의 이미지도 함께 삭제
 */
exports.deleteCloudinaryImage = functions.https.onCall(async (data, context) => {
  const { publicId } = data;

  // 인증 확인 (로그인한 사용자만)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      '로그인이 필요합니다.'
    );
  }

  if (!publicId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'publicId가 필요합니다.'
    );
  }

  try {
    // Cloudinary 설정 (환경변수에서 읽음)
    const cloudinaryCloudName = 'dhkgabcme';
    const cloudinaryApiKey = functions.config().cloudinary?.api_key;
    const cloudinaryApiSecret = functions.config().cloudinary?.api_secret;

    if (!cloudinaryApiKey || !cloudinaryApiSecret) {
      console.error('❌ Cloudinary 환경변수가 설정되지 않았습니다');
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Cloudinary 설정이 필요합니다.'
      );
    }

    // Cloudinary Destroy API 호출
    const authString = Buffer.from(
      `${cloudinaryApiKey}:${cloudinaryApiSecret}`
    ).toString('base64');

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/destroy`,
      {
        public_id: publicId,
        api_key: cloudinaryApiKey
      },
      {
        headers: {
          'Authorization': `Basic ${authString}`
        }
      }
    );

    console.log(`✅ Cloudinary 이미지 삭제 완료: ${publicId}`);

    return {
      success: true,
      publicId: publicId,
      result: response.data.result
    };
  } catch (error) {
    console.error('❌ Cloudinary 이미지 삭제 실패:', error.message);

    // 이미지가 이미 삭제된 경우도 성공으로 처리
    if (error.response?.data?.error?.message?.includes('not found')) {
      return {
        success: true,
        message: '이미지가 이미 삭제되었거나 존재하지 않습니다.'
      };
    }

    throw new functions.https.HttpsError(
      'internal',
      `Cloudinary 삭제 실패: ${error.message}`
    );
  }
});
