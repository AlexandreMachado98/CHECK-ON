"""Gera fotos de teste parecidas com as do app: 1600x1200, JPEG 70% (o app reduz para 1600 px e 70%).
Fundo com textura (como chão, lataria, pneu) para o tamanho do arquivo ficar realista: ~250-450 KB."""
import os, random, sys
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else 'fotos'
os.makedirs(out, exist_ok=True)
random.seed(42)
W, H = 1600, 1200
for n in range(12):
    base = Image.effect_noise((W // 4, H // 4), 60 + n * 4).convert('RGB').resize((W, H), Image.BICUBIC)
    tint = Image.new('RGB', (W, H), (random.randint(60, 200), random.randint(60, 200), random.randint(60, 200)))
    img = Image.blend(base, tint, 0.55)
    d = ImageDraw.Draw(img)
    for _ in range(25):
        x, y = random.randint(0, W), random.randint(0, H)
        r = random.randint(30, 260)
        color = tuple(random.randint(0, 255) for _ in range(3))
        (d.ellipse if random.random() < 0.5 else d.rectangle)((x, y, x + r, y + int(r * 0.7)), fill=color)
    grain = Image.effect_noise((W, H), 40 + n * 2).convert('RGB')
    img = Image.blend(img.filter(ImageFilter.GaussianBlur(0.8)), grain, 0.2)
    img.save(f'{out}/foto{n:02d}.jpg', 'JPEG', quality=70)
sizes = [os.path.getsize(f'{out}/{f}') for f in sorted(os.listdir(out))]
print(f'{len(sizes)} fotos, média {sum(sizes) / len(sizes) / 1024:.0f} KB (min {min(sizes) / 1024:.0f}, máx {max(sizes) / 1024:.0f})')
