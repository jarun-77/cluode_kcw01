# BRAND.md — KIMS Brand Identity
# ระบบบริหารจัดการนวัตกรรมทางการศึกษา โรงเรียนกระแชงวิทยา

---

## 1. ชื่อระบบ
- **ชื่อเต็ม (TH):** ระบบบริหารจัดการนวัตกรรมทางการศึกษา โรงเรียนกระแชงวิทยา
- **ชื่อย่อ:** KIMS (Krachangwittaya Innovation Management System)
- **Tagline:** "นวัตกรรมการศึกษา เพื่อพัฒนาผู้เรียน" | "Innovation for Learner Development"

---

## 2. แนวคิดแบรนด์
ระบบ KIMS สื่อถึงความเป็นมืออาชีพของครูในบริบทการศึกษาไทย ภายใต้สังกัด สพฐ.
- **ความน่าเชื่อถือ** — ระบบราชการ มีมาตรฐาน
- **ความทันสมัย** — Digital Transformation ในโรงเรียน
- **ความร่วมมือ** — ครูแบ่งปันนวัตกรรมให้กัน
- **การพัฒนา** — เพื่อยกระดับคุณภาพการศึกษา

---

## 3. Color Palette

### Primary Colors
| ชื่อ | HEX | RGB | การใช้งาน |
|------|-----|-----|-----------|
| Deep Blue (Primary) | `#1A5276` | rgb(26,82,118) | Header, Buttons หลัก, H1 |
| Royal Blue (Secondary) | `#2E86C1` | rgb(46,134,193) | Links, Accent, H2 |
| Teal (Accent) | `#148F77` | rgb(20,143,119) | Success, Tags, Badge |

### Secondary Colors
| ชื่อ | HEX | การใช้งาน |
|------|-----|-----------|
| Light Blue | `#D6EAF8` | Background Cards, Table header |
| Light Teal | `#D5F5E3` | Success state, Approved badge |
| Light Orange | `#FDEBD0` | Warning, Pending badge |
| Light Red | `#FADBD8` | Error, Rejected badge |
| Gray Background | `#F2F3F4` | Page background, Table rows |
| Dark Gray | `#566573` | Secondary text, captions |
| White | `#FFFFFF` | Card background, inputs |

### Status Colors
| สถานะ | สี | HEX |
|-------|-----|-----|
| Published (เผยแพร่) | Green | `#27AE60` |
| Pending (รออนุมัติ) | Orange | `#F39C12` |
| Draft (ร่าง) | Gray | `#85929E` |
| Rejected (ถูกปฏิเสธ) | Red | `#E74C3C` |

---

## 4. Typography

### Font Stack (Thai-first)
```css
/* หลัก: รองรับภาษาไทยและอังกฤษ */
--font-primary: 'Sarabun', 'TH Sarabun New', sans-serif;
--font-heading: 'Prompt', 'Sarabun', sans-serif;
--font-mono: 'Courier New', monospace;
```

### Font Scale
| ชื่อ | ขนาด | การใช้งาน |
|------|-------|-----------|
| Display | 2.5rem (40px) | Hero title |
| H1 | 2rem (32px) | Page titles |
| H2 | 1.5rem (24px) | Section titles |
| H3 | 1.25rem (20px) | Card titles |
| Body | 1rem (16px) | เนื้อหาทั่วไป |
| Small | 0.875rem (14px) | Labels, captions |
| Tiny | 0.75rem (12px) | Badges, timestamps |

### Import (Google Fonts)
```html
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">
```

---

## 5. Design Language

### Card Design
- Border radius: `12px`
- Box shadow: `0 2px 12px rgba(0,0,0,0.08)`
- Hover shadow: `0 6px 20px rgba(26,82,118,0.15)`
- Hover transform: `translateY(-4px)`
- Transition: `all 0.25s ease`

### Button Style
```css
.btn-primary {
  background: #1A5276;
  color: white;
  border-radius: 8px;
  padding: 10px 24px;
  font-weight: 600;
  border: none;
  transition: background 0.2s;
}
.btn-primary:hover { background: #2E86C1; }
```

### Type Badges
```css
.badge { border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 600; }
.badge-cai    { background: #D6EAF8; color: #1A5276; }
.badge-research { background: #D5F5E3; color: #148F77; }
.badge-plan   { background: #FDEBD0; color: #D35400; }
.badge-activity { background: #E8DAEF; color: #6C3483; }
.badge-tech   { background: #FDFEFE; color: #2C3E50; border: 1px solid #BDC3C7; }
```

---

## 6. UX Principles

1. **Thai First** — UI, labels, messages เป็นภาษาไทยทั้งหมด ยกเว้น Technical terms
2. **Teacher-Friendly** — ง่าย ไม่ซับซ้อน ครูใช้งานได้ทันทีโดยไม่ต้องฝึก
3. **Public Readable** — บุคคลทั่วไปค้นหาและอ่านได้ง่าย ไม่ต้องล็อกอิน
4. **Mobile Responsive** — รองรับมือถือและแท็บเล็ต (ครูมักใช้มือถือ)
5. **Feedback Always** — ทุก Action มี Loading, Success, Error feedback ชัดเจน
6. **OBEC Context** — ใช้ศัพท์และรูปแบบตาม สพฐ. (กลุ่มสาระ, ปีการศึกษา, ภาคเรียน)

---

## 7. Responsive Guideline
```
Mobile  (< 640px)  : 1 คอลัมน์, hamburger menu, full-width cards
Tablet  (640-1024px): 2 คอลัมน์, สรุปขนาดเล็ก
Desktop (> 1024px) : 3-4 คอลัมน์, sidebar dashboard
```

---
