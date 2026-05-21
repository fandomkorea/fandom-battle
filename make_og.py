"""og-image.png 생성 스크립트 (1200x630)"""
from PIL import Image, ImageDraw
import os

W, H = 1200, 630
img = Image.new("RGB", (W, H), "#0d0d1a")
draw = ImageDraw.Draw(img)

# 배경 그라디언트 효과 (밴드)
for i in range(H):
    t = i / H
    r = int(13 + t * 30)
    g = int(13 + t * 10)
    b = int(26 + t * 40)
    draw.line([(0, i), (W, i)], fill=(r, g, b))

# 왼쪽 핑크 원 장식
for radius in [260, 200, 140]:
    alpha = 30
    draw.ellipse([-radius + 80, H // 2 - radius, radius + 80, H // 2 + radius],
                 fill=None, outline=(255, 77, 141, alpha), width=1)

# 오른쪽 퍼플 원 장식
cx = W - 80
for radius in [260, 200]:
    draw.ellipse([cx - radius, H // 2 - radius, cx + radius, H // 2 + radius],
                 fill=None, outline=(124, 77, 255, 30), width=1)

# 상단 라벨
draw.rectangle([W // 2 - 120, 60, W // 2 + 120, 100], fill=(255, 77, 141, 30))
draw.text((W // 2, 80), "⚔️  LIVE 투표 중", fill="#ff4d8d", anchor="mm")

# 메인 타이틀
draw.text((W // 2, 230), "팬덤배틀", fill="#ffffff", anchor="mm")
draw.text((W // 2, 320), "아이돌 팬덤 파워 대결", fill="#ccccdd", anchor="mm")

# 서브 텍스트
draw.text((W // 2, 420), "BTS · BLACKPINK · aespa · NewJeans · IVE", fill="#8888aa", anchor="mm")
draw.text((W // 2, 460), "매주 새로운 빅매치 투표!", fill="#8888aa", anchor="mm")

# 하단 URL
draw.rectangle([0, H - 80, W, H], fill=(20, 20, 40))
draw.text((W // 2, H - 40), "fandomkorea.github.io/fandom-battle", fill="#7c4dff", anchor="mm")

# 좌우 VS 이모지
draw.text((W * 0.25, H // 2 - 20), "💜", anchor="mm")
draw.text((W * 0.75, H // 2 - 20), "🖤", anchor="mm")
draw.text((W // 2, H // 2 - 20), "VS", fill="#2a2a4a", anchor="mm")

out = os.path.join(os.path.dirname(__file__), "docs", "og-image.png")
img.save(out, "PNG", optimize=True)
print(f"저장됨: {out}")
