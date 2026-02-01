#!/usr/bin/env python3
"""
Generate app icons for Attendance App
Creates icons with white 'A' on blue (#4A90D9) background
"""
from PIL import Image, ImageDraw, ImageFont
import os

def create_app_icon(size, output_path, font_scale=0.7):
    """Create app icon with 'A' on blue background"""
    # Create image with blue background (#4A90D9)
    img = Image.new('RGBA', (size, size), '#4A90D9')
    draw = ImageDraw.Draw(img)

    # Font size: approximately 70% of image size for good visibility
    font_size = int(size * font_scale)

    # Try to load a bold sans-serif font
    font = None
    font_paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
    ]

    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                print(f"Using font: {font_path}")
                break
            except Exception as e:
                print(f"Failed to load {font_path}: {e}")
                continue

    if font is None:
        print("Warning: Using default font - icon may not look optimal")
        font = ImageFont.load_default()

    # Center the "A" character
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Calculate position to center text
    x = (size - text_width) // 2 - bbox[0]
    y = (size - text_height) // 2 - bbox[1]

    # Draw white "A"
    draw.text((x, y), text, fill='#FFFFFF', font=font)

    # Save image
    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

def main():
    # Base path for assets
    base_path = "/home/navdeep/Attendance_App/assets/"

    # Ensure assets directory exists
    os.makedirs(base_path, exist_ok=True)

    print("Generating app icons...")
    print(f"Output directory: {base_path}")
    print()

    # Generate main icon (1024x1024 for iOS and base)
    create_app_icon(1024, f"{base_path}icon.png")

    # Generate adaptive icon (1024x1024, but "A" should be smaller for safe zone)
    # Using 60% font scale for adaptive icon to account for Android masking
    create_app_icon(1024, f"{base_path}adaptive-icon.png", font_scale=0.6)

    # Generate favicon (48x48 for web)
    create_app_icon(48, f"{base_path}favicon.png", font_scale=0.7)

    print()
    print("Icon generation complete!")
    print()
    print("Next steps:")
    print("1. Review the generated icons in the assets/ directory")
    print("2. Run 'npx expo prebuild --clean' to generate Android/iOS native icons")
    print("3. Test the icons on iOS, Android, and web platforms")

if __name__ == "__main__":
    main()
