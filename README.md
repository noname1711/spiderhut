# The Last Swing — Hanoi

Current package: **v2.41.0**

# LÀM TÍ NHỆN NHỌ — HÀ NỘI · v2.31

Một trò chơi WebGL2 góc nhìn thứ nhất, món quà nhỏ của anh dành cho **Thủy**. Ba cảnh quan được dựng bằng mã 3D: Tây Hồ hoàng hôn, Phố cổ mưa đêm và cầu Chương Dương bình minh. Mỗi mốc mở một lời thương; mỗi chương có nhạc nền riêng.

## Chạy trò chơi

1. Giải nén toàn bộ ZIP và mở `index.html` bằng Chrome, Edge hoặc trình duyệt hiện đại hỗ trợ WebGL2.
2. Nếu trình duyệt chặn việc tải tệp từ `file://`, hãy mở terminal tại thư mục game, chạy `python3 -m http.server 8000` rồi truy cập `http://localhost:8000`.
3. Chọn **BẮT ĐẦU** → **TIẾP TỤC**. Có thể tắt/bật âm thanh ở nút ♫.

Toàn bộ ảnh, mã và nhạc nằm trong ZIP, không cần API, tài khoản hay CDN.

## Điều khiển

- Máy tính: **SPACE** để bắn/giữ tơ; thả SPACE để nhả; **A/D** để lái, **W/↑** để tăng tốc, **ESC** để tạm dừng.
- Điện thoại/tablet: dùng các nút cảm ứng ở cuối màn hình, hoặc chạm giữ vùng chơi để bắn tơ.
- Có thể chơi cả màn hình **dọc hoặc ngang**; xoay ngang sẽ cho góc nhìn FPV rộng hơn.

## v2.41 — Chương 3 có màu sắc hơn

- Bổ sung thêm **màu sắc nhẹ nhàng** cho cảnh vật ở **chương 3** để khung cảnh không còn quá xám.
- Tô lại một phần **mặt cầu, cột đèn, làn đường, bờ sông, cây xa, thuyền và các điểm sáng nhỏ** theo hướng bình minh ấm áp hơn.
- Giữ tổng thể vẫn hài hòa, không quá rực, để hợp với bầu trời và mặt nước hiện tại.

## v2.40 — Hồ Tây xanh ngọc hơn + chương 3 hài hòa màu sắc

- Đẩy mặt nước **Hồ Tây** sang tông **xanh ngọc rất thơ**, trong và dịu hơn nhưng vẫn giữ phản chiếu mềm.
- Tinh chỉnh ánh phản sáng trên nước để bớt gắt và hợp với không khí hoàng hôn lãng mạn.
- Tô lại màu cảnh vật **chương 3**: cầu, làn đường, kết cấu thép, bờ sông, cây xa và thuyền đều hài hòa hơn với bầu trời bình minh.
- Giữ nguyên gameplay, responsive và đồng bộ âm thanh từ v2.39.

## v2.39 — hồ xanh trong hơn + âm thanh đồng nhất

- Mặt nước **Hồ Tây** và **sông** được đẩy sang tông **xanh trong hơn**, sáng và sạch hơn bản v2.38.
- Nút âm thanh giờ **mặc định ở trạng thái bật** ngay từ màn mở đầu.
- Trạng thái âm thanh ở màn mở đầu và trong game được **đồng nhất hoàn toàn**: nếu tắt trước khi vào game thì vào game vẫn tắt, không tự bật lại.
- Khi bắt đầu chơi, game chỉ tôn trọng trạng thái âm thanh hiện tại thay vì ép bật lại.

## v2.38 — Nước xanh gọn mắt + chuyển chương mượt hơn

- Mặt nước ở **Hồ Tây** và **sông** được đơn giản hóa theo hướng **xanh sạch, dễ nhìn hơn**, bớt các lớp phản sáng rối mắt.
- Giữ hiệu ứng gợn và phản chiếu nhẹ, nhưng phối màu được làm gọn để hợp tổng thể game hơn.
- **Chuyển chương mượt hơn** nhờ nội suy màu môi trường giữa hai chương, cộng thêm một lớp flash mềm rất nhẹ để đổi cảnh tự nhiên hơn.
- `weather-layer` và lớp hậu cảnh UI cũng được thêm transition để không bị đổi tông quá gắt.
- Giữ nguyên gameplay, 6 ảnh, lời thương và khả năng responsive.

## Tối ưu hóa v2.29

- Ba mức chất lượng **Low / Medium / High**, tự khởi tạo theo kích thước màn hình, DPR và năng lực thiết bị (nếu trình duyệt cung cấp); tự giảm khi FPS thấp kéo dài.
- Giới hạn số điểm ảnh GPU, độ phức tạp lưới 3D, số khu vực dựng phía trước và số hạt mưa theo chất lượng.
- Giảm đáng kể số hình tam giác trong chế độ nhẹ mà **không thay đổi tọa độ điểm neo**.
- Cache khu cảnh theo block; không tính lại danh sách vùng 3D mỗi khung hình.
- Dùng nền trời WebGL gradient nhẹ với ba bảng màu riêng và mặt trời/mù nền phù hợp từng chương.
- UI co giãn với các breakpoint màn hình rất nhỏ và chiều cao thấp, có hỗ trợ safe-area và màn hình dọc, ngang.
- Loại bỏ hai mô-đun source không dùng (`src/gloves.js`, `src/content.js`); phần cá nhân hóa giờ chỉ có một nguồn là `gift-settings.js`.
- Bỏ hai bản WAV môi trường không được phát. Ảnh tay PNG yêu thích không thay đổi.

**Lưu ý:** Không thể bảo đảm mọi máy đều đạt FPS giống nhau. Máy muốn chơi cần hỗ trợ WebGL2 và cấu hình đồ họa hoạt động. Thiết bị quá cũ có thể không khởi động được game; màn hình và hình ảnh WebGL thật cần được kiểm tra thêm trên thiết bị của bạn.

## Cá nhân hóa

Chỉnh duy nhất `gift-settings.js` để thay tên, 6 lời thương, 3 đoạn giới thiệu và thư kết. Không cần build lại.

## Nguồn mã

- `src/main.js`: vòng chơi, điều khiển, nhạc và phản ứng theo FPS.
- `src/quality.js`: cấu hình và lựa chọn chất lượng.
- `src/world.js`: 3 bối cảnh, kiến trúc, neo tơ và cache khu cảnh.
- `src/renderer.js`: WebGL2, ánh sáng, fog, trời chuyển sắc và lưới hình học.
- `src/fx.js`: tơ và hiệu ứng phóng/bám/nhả.
- `src/physics.js`: vật lý đu tơ.
- `src/style.css`: giao diện và responsive.
- `scripts/build.mjs`: tạo `game.bundle.js` không phụ thuộc thư viện ngoài.

Chạy `node scripts/build.mjs` để build, `npm test` để kiểm thử. Bộ test kiểm tra tính đúng của source/physics và breakpoint, không thay thế kiểm thử hình ảnh trên GPU thật.


## v2.30 — Centered Swing / Safe Transitions
- Keep Spider-Hút close to the centerline with stage-aware invisible safety corridors, critically damped lateral movement, and subtle smooth camera sway.
- Drop ropes before stage transitions; attachment targets must match the current chapter.
- Preserve the PNG arms, all scenery and audio, responsive controls, and offline support.
- See `PATCH_NOTES.md` for exact tuning and 15 regression tests.

## v2.30.1 – Sửa lỗi khởi động
Bản v2.30.0 từng không hiện menu do hai module khai báo cùng một biến `clamp` khi ghép vào `game.bundle.js`. Đã đổi helper camera thành `clampCamera`, kiểm tra cú pháp bundle mỗi lần build và thêm màn báo lỗi khởi động. Để áp dụng, giải nén **toàn bộ** ZIP mới vào một thư mục riêng và tải lại trang bằng Ctrl+Shift+R. Cách chạy `python3 -m http.server 8000` không thay đổi.


## v2.31 — Ảnh trọn vẹn, cá nhân hóa đồng nhất, sửa lỗi kết thúc

- **Đã sửa lỗi kết thúc thực tế từ `web.zip`:** `gift-settings.js` có sáu lời thương nhưng thiếu `finalTitle` và `finalLetter`, khiến hàm `finalScreen()` lỗi `.map()` ở chương cuối. Đã khôi phục thư cuối và thêm fallback để phòng trường hợp bạn chỉnh thiếu nội dung.
- Màn chờ và tab trình duyệt dùng `mainTitle` của `gift-settings.js` (hiện là **Làm tí nhện nhọ**); các nhãn chương theo `chapters[].place`, bao gồm Chương Dương. Màn chơi cũng cập nhật theo nội dung bạn chỉnh mà không cần sửa source.
- Chương 3 đổi kiểu kết cấu từ dây văng cao sang giàn thép thấp gần tinh thần cầu Chương Dương hơn. Đây là đồ họa procedural cách điệu, không phải mô phỏng cầu thực địa 1:1.
- Ảnh `photos/1.jpeg` đến `photos/6.jpeg` được giữ nguyên. Màn nhận ảnh có bố cục bên ảnh–bên lời thương ở màn rộng; xếp dọc ở màn hẹp. CSS sử dụng `object-fit: contain`, không tự cắt ảnh.
- Lá thư cuối có bố cục cuộn được trên màn nhỏ, hai nút **Đu lại** và **Về màn chờ**. Hoàn thành game rồi quay lại màn chờ sẽ hiện **Chơi lại** thay cho việc tiếp tục một lượt đã kết thúc.
- Kiểm thử layout DOM trên Chromium ở các cỡ 320×568, 390×844, 667×375, 820×1180, 1366×768, 1920×1080. Kiểm thử này dùng bộ giả lập WebGL ở môi trường hiện tại; hình 3D trên GPU thực cần được kiểm tra trên máy bạn.

**Chỉnh lời chúc / ảnh:** mở `gift-settings.js`, thay `photo: './photos/1.jpeg'` bằng tên ảnh bạn muốn. Để thay thư cuối, chỉnh `finalTitle` và các dòng `finalLetter`. Lưu file, nhấn Ctrl+Shift+R để tải lại. Chỉnh `src/main.js` hoặc `src/world.js` mới cần chạy `node scripts/build.mjs`.

## Sửa lỗi v2.31.1

- Sửa crash `Cannot read properties of null (reading 'anchor')` khi dây bám và nhả trong cùng khung hình gần lúc chuyển chương.
- Màn đầu chương chỉ hiển thị khung cảnh và địa điểm, không lặp lại lời chúc; sáu lời thương nằm ở sáu mốc ảnh.
- Tất cả `photos/*.jpeg` và các bản nhạc trong `assets/audio/` được giữ nguyên.

Giải nén ra thư mục riêng, mở terminal ở thư mục có `index.html`, chạy `python3 -m http.server 8000`, truy cập `http://localhost:8000` và nhấn `Ctrl + Shift + R` nếu Chrome đang lưu bản cũ.

## v2.37 — Cinematic Water & Material Upgrade

- New **animated WebGL2 water shader** in Chapters 1 (West Lake) and 3 (Red River). It uses world-space waves, angle-dependent Fresnel/sky reflections, warm sun glints, bank tint, atmospheric fog and a bridge shadow. These are stylized shader reflections rather than mirror-quality real-time building reflections.
- Separate water patches have two triangles each and are streamed/disposed with their world chunks. Legacy static reflection strips were removed to avoid wasted geometry.
- New procedural shaders for **terracotta roof tiles**, **weathered Old Quarter plaster** and **wet asphalt**. Extra high-detail balcony rails, rain pipes and parked scooters are added only at medium/high detail.
- Sky clouds drift subtly in time. Existing sound, hands PNG, chapter story, six photos and gift settings are preserved.
- Adaptive quality remains enabled; simpler water shading is selected on low-quality devices.
- For editing romantic text and photos, use `gift-settings.js` and the `photos/` directory without rebuilding.
- For editing renderer/world logic, run `node scripts/build.mjs`, then refresh your browser. `npm test` checks gameplay and shader/source invariants, but not actual WebGL2 GPU visual output.
