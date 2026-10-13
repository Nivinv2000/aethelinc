// Set up the hero draw-in: measure each path so the stroke can animate in.
document.documentElement.classList.add('js');

document.querySelectorAll('.mark-draw .lines path').forEach((path, i) => {
  path.style.setProperty('--len', Math.ceil(path.getTotalLength()));
  path.style.setProperty('--i', i);
});
