# HC Photos (Bootstrap)

Bản bootstrap triển khai theo docs đã chốt:
- Không Nginx
- FE `127.0.0.1:45173`
- BE `127.0.0.1:45174`
- Route public qua Cloudflare Tunnel

## 1) Khởi tạo
```bash
cd ~/workspace/.h-projects/hc-photos
cp .env.example .env
# sửa các biến quan trọng trong .env (email/pass, jwt secrets, mount point)
```

## 2) Chạy local bằng Docker
```bash
docker compose up -d --build
```

## 3) Kiểm tra nhanh
- FE: http://127.0.0.1:45173
- BE health: http://127.0.0.1:45174/api/health
- Storage usage: http://127.0.0.1:45174/api/storage/usage (cần login)

## 4) Cloudflare tunnel (sau khi có domain)
Sửa file: `infra/cloudflared/config.example.yml`

## 5) Trạng thái hiện tại
Đây là skeleton MVP:
- ✅ Login/logout cookie session JWT
- ✅ Endpoint dung lượng ổ (`/api/storage/usage`)
- ✅ Dashboard FE hiển thị usage
- ⏳ Upload chunk, media processing queue, DB schema chi tiết sẽ triển khai ở bước tiếp theo
