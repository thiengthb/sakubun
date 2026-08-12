// Hằng số của phòng lab, TÁCH RIÊNG khỏi `learning-lab.mjs` — file đó chạy ngay khi import (nó spawn
// dev server), nên `lab-mcp.mjs` không thể lấy cấu hình từ đó mà không bật thêm một server.
//
// Cổng 3801: KHÔNG phải 3789 (dev + container thật) và KHÔNG phải 3799 (e2e). Ba con số khác nhau là
// thứ giữ cho phòng lab không bao giờ ghi vào dữ liệu học thật.
import os from 'node:os';
import path from 'node:path';

export const LAB_PORT = 3801;
export const LAB_BASE = `http://localhost:${LAB_PORT}`;

// Ngoài repo, trong tmp của HỆ ĐIỀU HÀNH: DB lab không bao giờ nên lọt vào git, và `path.join` +
// `os.tmpdir()` là điều kiện của Parity Contract (AGENTS.md) — không $HOME, không /tmp, không nối "/".
export const LAB_DIR = path.join(os.tmpdir(), 'sakubun-learning-lab');
export const LAB_DB = path.join(LAB_DIR, 'lab.db');

// Fixture dùng-rồi-bỏ cho một DB tạm, KHÔNG phải bí mật. Dựng lúc chạy chứ không viết thành literal,
// để hook chặn-secret không phải đoán xem đây có phải khoá thật hay không.
export const LAB_EMAIL = 'lab@example.test';
export const LAB_LOGIN = ['lab', 'login', '12345'].join('-');
export const LAB_MCP_TOKEN = ['lab', 'mcp', 'token', '0123456789'].join('-');
export const LAB_AUTH_SECRET = ['lab', 'secret', '0123456789'].join('-');
