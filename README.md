# 온트립 | 여행지와 숙소 소개 및 예약

HTML, CSS, 순수 JavaScript(ES Modules), Firebase Authentication 및 Realtime Database를 사용하는 정적 웹사이트입니다. 메인 페이지는 루트의 `index.html`, 별도 관리자 페이지는 `html/admin.html`이며 CSS와 JavaScript는 각각 `css/`, `js/`에 있습니다.

## 로컬에서 보기

프로젝트 루트 폴더(`D:\웹사이트\travel`)에서 `python -m http.server 8000`을 실행한 뒤 `http://localhost:8000/`을 여세요. 관리자 페이지는 `http://localhost:8000/html/admin.html`입니다. ES Modules 때문에 HTML 파일을 직접 열면 안 됩니다.

## Firebase 설정

1. Firebase Console의 **Authentication → 로그인 방법**에서 이메일/비밀번호 제공업체를 사용 설정합니다.
2. **Realtime Database**를 만들고 데이터베이스 URL을 확인합니다.
3. Firebase 웹 앱 설정을 `js/firebase-config.js`에 넣습니다. 이 프로젝트에는 전달된 `test-d68d8` 프로젝트 설정을 연결해 두었습니다.
4. Realtime Database의 **규칙** 탭에 `database.rules.json` 내용을 붙여 넣고 **게시**합니다. 규칙을 게시하지 않으면 회원가입 계정은 만들어져도 `members/{uid}` 쓰기가 거부될 수 있습니다. Firebase CLI를 쓰는 경우 프로젝트에 로그인한 뒤 `firebase deploy --only database`로 같은 규칙을 게시할 수 있도록 `firebase.json`과 `.firebaserc`를 준비했습니다.
5. Vercel 배포 시 Firebase Authentication의 승인된 도메인에 배포 도메인을 추가합니다. 로컬 테스트 주소 `localhost`도 승인 목록에 있어야 합니다.
6. 현재 관리자 계정은 Firebase Authentication에 등록된 `yth6263@gmail.com`입니다. `html/admin.html`에서 이 이메일과 비밀번호로 로그인합니다. `database.rules.json`에도 이 계정의 이메일을 관리자 권한으로 추가했으므로, 규칙 탭에 파일 내용을 게시해야 예약 조회와 DB 쓰기가 적용됩니다. 예약 화면에 `permission_denied`가 나오면 Firebase Console에서 이 파일의 최신 규칙을 게시하세요. 비밀번호는 코드나 Realtime Database에 기록하지 않습니다.

```js
// (선택 사항) 다른 관리자 계정은 비공개 서버 또는 관리자 전용 스크립트에서 권한을 부여
await getAuth().setCustomUserClaims('FIREBASE_USER_UID', { admin: true });
```

앱은 `admin: true` 커스텀 클레임도 추가 관리자로 허용합니다. Admin SDK 서비스 계정 키를 프런트엔드 또는 GitHub에 올리지 마세요.

## 데이터 구조

- `destinations/{id}`: `name`, `address`, `image`, `description`
- `stays/{id}`: `name`, `destinationId`, `address`, `phone`, `roomName`, `roomCount`, `capacity`, `price`, `image`
- `members/{uid}`: `name`, `phone`, `email`, `createdAt` (비밀번호는 Firebase Authentication에서 관리)
- `bookings/{id}`: `userId`, `stayId`, `stayName`, `guestName`, `phone`, `email`, `checkIn`, `checkOut`, `guests`, `status`, `createdAt`

관리자 화면은 `html/admin.html` 및 `js/admin.js`에 있습니다. 예약 화면은 `/bookings` 데이터를 예약 ID별로 읽고 `guestName`, `stayName`, `checkIn`, `checkOut`, `guests`, `status` 필드를 표시합니다.

## GitHub 및 Vercel 배포

1. 이 폴더를 GitHub 저장소에 push합니다.
2. Vercel에서 저장소를 Import합니다. 프레임워크는 Other로 두고 Build Command 및 Output Directory는 비워 둡니다. 메인 사이트는 `/`, 관리자 페이지는 `/html/admin.html` 또는 `/admin`으로 접속합니다.
3. 배포 전에 `js/firebase-config.js`의 설정을 채우고 Vercel 도메인을 Firebase Authentication의 승인된 도메인에 추가합니다.

Firebase 웹 설정의 API 키는 브라우저용 식별자이며 접근 통제는 Firebase Authentication과 데이터베이스 규칙이 담당합니다. 데이터베이스 규칙을 테스트 모드로 공개 배포하지 마세요.

회원가입은 먼저 Firebase Authentication에 이메일과 비밀번호로 계정을 만들고, 생성된 UID를 키로 `members/{uid}`에 이름·전화번호·이메일을 저장합니다. 비밀번호는 Realtime Database에 저장하지 않습니다.

숙소 예약은 로그인 회원이 `bookings`에 `pending` 상태로 신청합니다. 회원 예약 목록은 `userId`로 필터링해 본인 예약만 읽습니다. 관리자는 Firebase Authentication 이메일 `yth6263@gmail.com`으로 전체 예약을 조회하고 상태를 변경합니다. 이 권한이 실제 Firebase에 적용되도록 `database.rules.json`을 Firebase Console에 게시하세요.
