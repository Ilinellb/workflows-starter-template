// Simple icon generator for PWA
// This creates a basic colored square with the time emoji as placeholder
// In production, you would use proper app icons

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function createIcon(size) {
  canvas.width = size;
  canvas.height = size;
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#3b82f6');
  gradient.addColorStop(1, '#1d4ed8');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Add time emoji or icon
  ctx.font = `${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText('⏰', size / 2, size / 2);
  
  return canvas.toDataURL('image/png');
}

// Generate icons for different sizes
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(size => {
  const link = document.createElement('a');
  link.download = `icon-${size}x${size}.png`;
  link.href = createIcon(size);
  link.click();
});