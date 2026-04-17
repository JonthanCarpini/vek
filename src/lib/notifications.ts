'use client';

const SOUNDS = {
  order: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
  call: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3',
};

export function playNotificationSound(type: keyof typeof SOUNDS) {
  try {
    const audio = new Audio(SOUNDS[type]);
    audio.play().catch(e => console.error('Error playing sound:', e));
  } catch (e) {
    console.error('Notification sound error:', e);
  }
}
