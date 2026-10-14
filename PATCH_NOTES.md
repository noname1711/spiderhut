# PATCH NOTES

## v2.41.0 — richer chapter 3 color accents

- Tăng thêm màu sắc cho **chương 3** theo hướng tinh tế: cầu có accent ấm hơn, làn ngoài và dải phân cách dịu hơn, đèn sáng hơn một chút.
- Bờ sông và cây xa được pha nhiều sắc xanh-olive / xanh rêu / vàng sớm để khung cảnh sống động hơn.
- Thuyền, phao sáng và các chi tiết nhỏ trên sông có thêm điểm nhấn màu để cảnh không quá đơn sắc.
- Tinh chỉnh nhẹ palette môi trường của chương 3 để đồng bộ với các accent mới.
- Build lại bundle và xác nhận **27/27 test pass**.

## v2.40.0 — poetic turquoise West Lake + chapter 3 recolor pass

- Chỉnh shader nước ở **chương 1** theo hướng **xanh ngọc / turquoise** thơ hơn, trong hơn và dịu mắt hơn.
- Giảm độ gắt của highlight mặt nước, đồng thời thêm tint phản chiếu hợp hơn với tông hồ Tây hoàng hôn.
- Recolor **chương 3** để hợp lý hơn: mặt cầu, làn xe, truss thép, bờ sông, cây xa, thuyền và chi tiết phụ được đưa về cùng hệ màu bình minh.
- Tinh chỉnh thông số môi trường chương 3 (clear/fog/sky/light) để khớp với palette mới.
- Build lại bundle và xác nhận **27/27 test pass**.

## v2.39.0 — clearer blue water + unified audio state

- Tăng độ **trong xanh** cho mặt nước ở chương 1 và chương 3 bằng cách nâng tông xanh lam/xanh ngọc, giảm fog hòa trộn trên bề mặt nước và giữ phản chiếu nhẹ.
- Chuyển trạng thái âm thanh mặc định sang **BẬT** ngay từ màn chờ.
- Sửa logic `start()` để **không tự bật âm thanh lại** nếu người chơi đã tắt nó từ menu/chapter screen trước khi vào game.
- Đồng bộ nút âm thanh ở màn đầu và trong HUD trong game để cả hai luôn phản ánh cùng một trạng thái.
- Build lại bundle và xác nhận **27/27 test pass**.

## v2.38.0 — simplified blue water + smoother chapter transitions

- Đơn giản hóa shader mặt nước theo hướng **xanh nước biển / xanh hồ** dễ nhìn hơn, giảm cảm giác “xấu xấu” do quá nhiều highlight vàng và nhiễu nhỏ.
- Giữ gợn sóng, phản chiếu bầu trời và ánh sáng, nhưng phối màu sạch hơn ở cả **Hồ Tây** và **sông chương 3**.
- Thêm **nội suy môi trường khi đổi chương**: màu trời, sương, mặt trời, fog và ánh sáng chuyển dần thay vì đổi đột ngột.
- Thêm một **scene flash** rất nhẹ và transition CSS cho weather/background để hiệu ứng đổi chương tự nhiên hơn.
- Build lại bundle và xác nhận **27/27 test pass**.

## v2.37.0 — Cinematic Water & Material Upgrade

- **Hồ Tây**: thay mặt hồ dạng các khối phẳng bằng shader gợn sóng động, phản sáng theo góc nhìn (Fresnel), màu trời phản chiếu, vệt nắng và lớp nước sát bờ.
- **Sông Hồng**: áp dụng vật liệu nước động với ánh bình minh, bóng mềm dưới cầu và sương xa.
- **Phố cổ**: thêm chất liệu procedural cho mái ngói đất nung, vữa tường nhuốm thời gian, mặt đường ướt; bổ sung chi tiết 3D ban công gỗ, ống thoát nước và xe máy đỗ khi mức chi tiết cho phép.
- **Bầu trời**: mây mờ trôi chậm thay vì đứng yên, tông màu theo từng chương.
- **Tối ưu**: thay hàng trăm vệt phản chiếu tĩnh bằng shader riêng và mặt nước 2 tam giác/khu; tự giải phóng bộ đệm GPU theo khu vực và giữ Low/Medium/High.
- **Không thay đổi**: vật lý đu tơ, hành lang an toàn, 6 ảnh, lời thương cho Thủy, menu và nhạc nền.
- Kết quả kiểm thử: 27/27 bài Node đạt; 8/8 shader biên dịch trên Mesa OpenGL (kiểm tra bổ sung, không tương đương chạy thực tế bằng WebGL2 trong Chromium).


## v2.36.0 — cinematic water + old quarter atmosphere pass
- Đẩy mạnh chất lượng mặt nước ở **Hồ Tây** và **sông chương 3** theo hướng điện ảnh hơn.
- Chương 1 có thêm các lớp phản sáng hoàng hôn, dải phản xạ mặt trời và chiều sâu mặt hồ tự nhiên hơn.
- Chương 3 có thêm phản xạ bình minh trên sông, lớp nước sâu hơn và các dải lấp lánh mềm hơn dưới cầu.
- **Phố cổ Hà Nội** được tăng độ đặc trưng: thêm nhiều chi tiết kiểu nhà ống, mái ngói, biển dọc, đèn treo, dây trang trí, cửa chớp và chậu cây nhỏ.
- Tăng độ “tình” của toàn cảnh bằng cách polish lại **bầu trời / haze / sương / ánh sáng** ở cả 3 chương.
- Tinh chỉnh bảng màu môi trường cho hoàng hôn, đêm mưa phố cổ và bình minh trên cầu để đồng nhất và giàu cảm xúc hơn.
