# 🎓 HVNH Lecturer Schedule — Tra cứu Thời khóa biểu Giảng viên Học viện Ngân hàng

Công cụ web tra cứu thời khóa biểu giảng viên **Học viện Ngân hàng (HVNH)** tối giản, sắc nét với **Giao diện sáng trắng**, hiển thị tức thì **6 tuần liên tiếp kể từ tuần hiện tại**, tích hợp **Bộ đệm Offline JSON Cache + Nhãn trạng thái kiểm tra đồng bộ ngầm** và xuất file **Google Calendar / Apple Calendar (.ics)**.

Dữ liệu được kết nối và đồng bộ trực tiếp từ cổng thông tin đào tạo Học viện Ngân hàng: [online.hvnh.edu.vn/public/tracuuthoikhoabieu](https://online.hvnh.edu.vn/public/tracuuthoikhoabieu).

---

## 🎨 Giao diện & Tính năng nổi bật

- **Giao diện Siêu Tối Giản (Ultra-Clean White UI)**:
  - Loại bỏ hoàn toàn các thanh Menu/Tab, tiêu đề chữ dư thừa và phần thẻ thống kê không cần thiết.
  - Ô tìm kiếm giảng viên thu ngắn 50% tạo góc nhìn tập trung, thanh lịch.
- **1 Ô Tìm kiếm Giảng viên (Chiều rộng 50%) + Gợi ý tên khi nhập**:
  - Ô tìm kiếm nhanh với dropdown tự động gợi ý giảng viên.
- **2 Thẻ Tag gợi ý sẵn (Tải tự động)**:
  - **Nguyễn Hoàng Anh** (Mã GV: `NHH00966`)
  - **Ngô Văn Bình** (Mã GV: `NHH00965`)
  - Nhấp vào tag để **tự động nạp ngay thời khóa biểu 6 tuần** từ bộ đệm.
- **Hiển thị ngay 6 Tuần từ Offline Cache + Nhãn trạng thái cập nhật**:
  - Khi vừa vào, hệ thống **hiển thị ngay lập tức lịch 6 tuần** đã lưu trữ trong bộ đệm Offline JSON (`cache/prof_<ID>.json`) với thời gian nạp ~0ms.
  - **Nhãn trạng thái bên cạnh tiêu đề lịch**:
    - 🔄 `Lịch từ Cache (Đang kiểm tra cập nhật...)`: Đang chạy kiểm tra ngầm với máy chủ online.
    - ✅ `Đã đồng bộ mới nhất`: Xác nhận lịch trên cache đã trùng khớp mới nhất với trang online.
    - ⚡ `Vừa tự động cập nhật thay đổi!`: Tự động nạp dữ liệu mới khi có điều chỉnh lịch trên trang online.
- **Xuất lịch 6 tuần ra Google Calendar (.ics)**:
  - Xuất toàn bộ các ca dạy trong 6 tuần tính từ tuần hiện tại thành file `.ics` chỉ với 1 cú nhấp chuột.
- **Tự động chuyển cổng linh hoạt (`EADDRINUSE`)**:
  - Máy chủ tự động chuyển cổng (3000 -> 3001 -> 3002,...) nếu cổng bận khi chạy `npm start`.

---

## 🛠️ Công nghệ sử dụng

- **Backend**: Node.js, Express.js, Cheerio, File System Caching (`fs`), Live Sync Check.
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), CSS3 (Clean White Palette, Flexbox, Responsive Grid).
- **Icons & Fonts**: FontAwesome 6, Google Fonts (`Outfit` & `Plus Jakarta Sans`).

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Cài đặt phụ thuộc
```bash
npm install
```

### 2. Khởi chạy máy chủ
```bash
npm start
```

### 3. Truy cập ứng dụng
Mở trình duyệt web và truy cập:
👉 **[http://localhost:3000](http://localhost:3000)** (Hoặc `http://localhost:3001` / `http://localhost:3002` tùy thuộc vào cổng hiển thị trên cửa sổ Terminal).

---

## 📖 Hướng dẫn sử dụng

1. Bấm trực tiếp vào tag gợi ý **Nguyễn Hoàng Anh** hoặc **Ngô Văn Bình** ở bên dưới ô tìm kiếm.
2. Hoặc gõ tên giảng viên vào ô tìm kiếm (chiều rộng 50%) và chọn từ danh sách gợi ý.
3. Giao diện sẽ **nạp ngay kết quả 6 tuần từ Offline Cache**, đồng thời hiển thị **nhãn trạng thái đồng bộ ngầm** ở ngay cạnh tiêu đề.
4. Bấm nút **Xuất Google Calendar (.ics)** ở góc phải để tải file lịch về máy.
