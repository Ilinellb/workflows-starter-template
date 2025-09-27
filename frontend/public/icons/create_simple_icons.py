from PIL import Image, ImageDraw, ImageFont
import os

# Create directory if it doesn't exist
os.makedirs('.', exist_ok=True)

# Icon sizes needed for PWA
sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    # Create new image with blue gradient background
    img = Image.new('RGBA', (size, size), (59, 130, 246, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle background
    corner_radius = size // 8
    draw.rounded_rectangle(
        [0, 0, size-1, size-1],
        radius=corner_radius,
        fill=(59, 130, 246, 255),
        outline=(29, 78, 216, 255),
        width=2
    )
    
    # Add clock emoji or symbol
    font_size = size // 2
    try:
        # Try to use a system font
        font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", font_size)
    except:
        font = ImageFont.load_default()
    
    # Draw clock symbol
    text = "⏰"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
    
    # Save icon
    img.save(f'icon-{size}x{size}.png', 'PNG')
    print(f"Created icon-{size}x{size}.png")

print("All PWA icons created successfully!")
