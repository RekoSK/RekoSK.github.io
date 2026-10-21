/* rekosk.dev: the About section's logo boxes (languages, tools, Linux) and the Linux box's terminal */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, stopSounds, ui } = site;

  // favorite languages box: click to reveal / hide the answer
  // logo boxes (programming languages, tools): same behaviour for each
  function setupLogoBox(favBox) {
    // language logos: if they don't all fit in the box at full size, they scroll in an endless loop
    function fitLangs() {
      const strip = $('.lang-strip', favBox);
      const track = $('.lang-track', strip);
      if (!strip || !track) return;
      clearLang();
      $$('[data-clone]', track).forEach((n) => n.remove());
      strip.classList.remove('scrolling');
      const setW = track.scrollWidth;
      if (setW <= strip.clientWidth) return;
      Array.from(track.children).forEach((img) => {
        const c = img.cloneNode(true);
        c.setAttribute('data-clone', '');
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('tabindex', '-1');
        c.classList.remove('sel');
        track.appendChild(c);
      });
      strip.style.setProperty('--lang-dur', (setW / 45).toFixed(1) + 's'); // ~45px per second
      strip.classList.add('scrolling');
    }
    window.addEventListener('resize', () => { if (favBox && favBox.classList.contains('open')) fitLangs(); });
    if (favBox) $$('.lang-track img', favBox).forEach((img) => img.addEventListener('load', () => { if (favBox.classList.contains('open')) fitLangs(); }));
    // clicking a logo stops the loop, enlarges it and shows its name; clicking it again (or another one) moves on
    function selectLang(item) {
      const strip = $('.lang-strip', favBox);
      const was = item.classList.contains('sel');
      $$('.lang-item.sel', favBox).forEach((n) => n.classList.remove('sel'));
      if (was) { strip.classList.remove('paused'); const t0 = $('.lang-track', strip); if (t0) t0.style.translate = ''; return; }
      item.classList.add('sel');
      strip.classList.add('paused');
      // keep the name centred under its logo: if the picked logo sits at a scrolling strip's faded edge, slide the strip so logo + name are fully in view
      const nm = $('.lang-name', item), trk = item.parentElement;
      if (nm && trk && strip.classList.contains('scrolling')) {
        const sr = strip.getBoundingClientRect(), ir = item.getBoundingClientRect();
        const cur = parseFloat(trk.style.translate) || 0;
        const inset = sr.width * 0.08, half = Math.max(ir.width, nm.offsetWidth) / 2 + 4, cx = ir.left + ir.width / 2 - cur;
        let d = 0;
        if (cx - half < sr.left + inset) d = sr.left + inset - (cx - half);
        else if (cx + half > sr.right - inset) d = sr.right - inset - (cx + half);
        trk.style.translate = d ? d.toFixed(1) + 'px 0' : '';
      }
      try { ui.play('pop'); } catch (err) {}
    }
    function clearLang() {
      $$('.lang-item.sel', favBox).forEach((n) => n.classList.remove('sel'));
      const strip = $('.lang-strip', favBox);
      if (strip) { strip.classList.remove('paused'); const t0 = $('.lang-track', strip); if (t0) t0.style.translate = ''; }
    }
    if (favBox) {
      const track = $('.lang-track', favBox);
      track.parentElement.addEventListener('click', (e) => {
        e.stopPropagation(); // clicks among the logos never close the box
        const item = e.target.closest('.lang-item');
        if (item) selectLang(item);
      });
      track.addEventListener('keydown', (e) => {
        const item = e.target.closest('.lang-item');
        if (!item || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault(); e.stopPropagation();
        selectLang(item);
      });
      // moving the mouse off the selected logo lets go of it and resumes the loop
      track.addEventListener('pointerout', (e) => {
        if (e.pointerType !== 'mouse') return;
        const sel = e.target.closest('.lang-item.sel');
        if (sel && !(e.relatedTarget && sel.contains(e.relatedTarget))) clearLang();
      });
      // leaving the box with the mouse: let go of the selected language and resume the loop
      favBox.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'mouse' && $('.lang-item.sel', favBox)) clearLang();
      });
      const toggleFav = () => {
        const on = favBox.classList.toggle('open');
        if (!on) clearLang();
        favBox.setAttribute('aria-expanded', String(on));
        if (on) fitLangs();
        try { ui.play(on ? 'pop' : 'tick'); } catch (err) {}
      };
      favBox.addEventListener('click', toggleFav);
      favBox.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFav(); } });
      // the little terminal (Linux box): type a command + Enter; clicks/keys in it never toggle the box
      const term = $('.term', favBox);
      if (term) {
        const tin = $('.term-in', term), live = $('.term-line', term);
        term.addEventListener('click', (e) => { e.stopPropagation(); tin.focus(); });
        term.addEventListener('keydown', (e) => e.stopPropagation());
        const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
        $('.term-arr', live).before(el('span', 'term-x', '✗'));
        // fastfetch / neofetch: a shortened copy of Reko's real fastfetch
        const FETCH = [['OS', 'Arch Linux x86_64'], ['Host', 'ASUS TUF Gaming A15'], ['WM', 'Hyprland 0.56.2 (Wayland)'], ['Terminal', 'kitty 0.49.2'],
          ['CPU', 'AMD Ryzen 5 7535HS'], ['GPU 1', 'NVIDIA GeForce RTX 2050'], ['GPU 2', 'AMD Radeon 680M'], ['Memory', '16 GB'], ['Swap', '4 GB'],
          ['Disk (/)', '512 GB'], ['Disk (Windows)', '256 GB']];
        const fetchOut = () => {
          const out = el('span', 'ff');
          out.append(el('span', 'ff-logo', '      /\\\n     /  \\\n    /\\   \\\n   /      \\\n  /   ,,   \\\n /   |  |  -\\\n/_-\'\'    \'\'-_\\'));
          const info = el('span', 'ff-info'), head = el('span', 'ff-row');
          head.append(el('b', '', 'reko'), '@', el('b', '', 'archreko'));
          info.append(head, el('span', 'ff-row', '-------------'));
          FETCH.forEach(([k, v]) => { const r = el('span', 'ff-row'); r.append(el('b', '', k), ': ' + v); info.append(r); });
          const cols = el('span', 'ff-cols');
          for (let i = 0; i < 16; i++) cols.append(el('i'));
          info.append(cols);
          out.append(info);
          return out;
        };
        // duhel / rekoboss: no output, they just launch duhel_railways.run / bossfight.exe (js/bossfight.js)
        const CMDS = { fastfetch: fetchOut, neofetch: fetchOut, duhel: () => { document.dispatchEvent(new CustomEvent('reko:duhel')); },
          rekoboss: () => { document.dispatchEvent(new CustomEvent('reko:bossfight-open')); } };
        // switch the whole site off (see shutdown / reboot below); a black screen over everything that swallows every
        // click and key (except the ones that refresh the page) and never goes away by itself
        const powerOff = (reboot) => {
          const pwr = el('div', 'pwr'), scr = el('i', 'pwr-scr');
          pwr.append(scr);
          const swallow = (e) => {
            if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && /^r$/i.test(e.key || ''))) return; // refreshing turns it back on
            e.preventDefault(); e.stopImmediatePropagation();
          };
          ['keydown', 'keypress', 'keyup', 'wheel', 'touchmove'].forEach((t) => window.addEventListener(t, swallow, { capture: true, passive: false }));
          const off = () => {
            document.body.append(pwr);
            document.documentElement.classList.add('pwr-lock');
            if (!reduceMotion) { pwr.classList.add('off'); try { ui.play('pcOff'); } catch (err) {} }
            try { ui.play('chaseStop', 0, 0, true); ui.silence(reduceMotion ? 0 : 0.42); } catch (err) {}
            stopSounds();
            $$('video, audio').forEach((v) => { try { v.pause(); } catch (err) {} });
          };
          if (reduceMotion) { off(); if (reboot) setTimeout(() => location.reload(), 300); return; }
          setTimeout(off, 350);
          if (!reboot) return;
          // reboot: a moment in the dark, then the screen warms up again (a dot, a line, a flash), a lone console caret
          // blinks for a bit and the page reloads (straight into the black screen the intro starts from)
          setTimeout(() => {
            pwr.classList.remove('off'); void pwr.offsetWidth; pwr.classList.add('on');
            try { ui.wake(); ui.play('pcOn'); } catch (err) {}
          }, 350 + 450 + 900);
          setTimeout(() => pwr.append(el('b', 'pwr-caret')), 350 + 450 + 900 + 650);
          setTimeout(() => location.reload(), 350 + 450 + 900 + 650 + 900);
        };
        // output appears like a hint in the achievements window: typed out with an orange caret and soft ticks
        let busy = false;
        const typeOut = (out, then) => {
          const walk = document.createTreeWalker(out, NodeFilter.SHOW_TEXT), parts = [];
          while (walk.nextNode()) { parts.push([walk.currentNode, walk.currentNode.data]); }
          parts.forEach(([n]) => { n.data = ''; });
          const later = $$('.ff-cols', out);
          later.forEach((n) => { n.style.visibility = 'hidden'; });
          const caret = el('span', 'term-caret');
          let p = 0, i = 0, n = 0;
          const finish = () => { clearInterval(tw); caret.remove(); later.forEach((c) => { c.style.visibility = ''; }); busy = false; term.scrollTop = term.scrollHeight; if (then) then(); };
          const step = () => {
            for (let k = 0; k < 2 && p < parts.length; k++) {
              const [node, full] = parts[p];
              node.data = full.slice(0, ++i);
              node.after(caret);
              if (i >= full.length) { p++; i = 0; }
            }
            if (++n % 2 === 0) try { ui.play('tick', 3200, 0.02); } catch (err) {}
            term.scrollTop = term.scrollHeight;
            if (p >= parts.length) finish();
          };
          busy = true;
          const tw = setInterval(step, 12);
          if (reduceMotion) { parts.forEach(([node, full]) => { node.data = full; }); finish(); }
        };
        // "sudo rm -rf / --no-preserve-root" (the sticker, dropped in here): it asks for the password, then deletes the whole
        // system file by file and never finishes (when it's through it just starts over). The terminal takes nothing anymore,
        // only a reload brings it back
        term.addEventListener('reko:rmrf', () => {
          if (term.classList.contains('rmrf')) return;
          term.classList.add('rmrf');
          busy = true;
          tin.value = ''; tin.disabled = true; tin.blur();
          const line = el('span', 'term-line' + (live.classList.contains('err') ? ' err' : ''));
          const cmd = el('span', 'term-cmd ok'), caret = el('span', 'term-caret');
          line.append($('.term-pill', live).cloneNode(true), $('.term-x', live).cloneNode(true), $('.term-arr', live).cloneNode(true), cmd, caret);
          term.insertBefore(line, live);
          live.remove();
          const out = el('span', 'term-rm'), pw = el('span', '', '[sudo] password for reko: ');
          out.append(pw);
          // the disk sounds only play while the terminal can be seen (Linux box open and scrolled into view)
          let seen = true;
          new IntersectionObserver(([en]) => { seen = en.isIntersecting; }).observe(term);
          // what's on the disk: every directory in / with a few made-up but believable files
          const pick = (a) => a[Math.floor(Math.random() * a.length)];
          const num = (n) => String(Math.floor(Math.random() * n));
          const BIN = ['ls', 'cat', 'cp', 'mv', 'bash', 'sh', 'grep', 'sed', 'awk', 'find', 'tar', 'gzip', 'pacman', 'makepkg', 'git', 'python3', 'node', 'gcc', 'make', 'cmake', 'ssh', 'curl', 'wget', 'nano', 'vim', 'kitty', 'Hyprland', 'hyprctl', 'waybar', 'fastfetch', 'neofetch', 'firefox', 'code', 'blender', 'krita', 'arduino-cli', 'systemctl', 'journalctl', 'mount', 'chmod', 'chown', 'ping', 'ip', 'htop', 'unzip', 'rustc', 'cargo', 'kotlinc', 'dotnet', 'pipewire', 'wireplumber', 'grim', 'slurp', 'wofi', 'sudo', 'su', 'rm'];
          const LIB = ['libc.so.6', 'libm.so.6', 'libstdc++.so.6', 'libgcc_s.so.1', 'libssl.so.3', 'libcrypto.so.3', 'libz.so.1', 'libGL.so.1', 'libEGL.so.1', 'libvulkan.so.1', 'libwayland-client.so.0', 'libxkbcommon.so.0', 'libpipewire-0.3.so.0', 'libsystemd.so.0', 'libdbus-1.so.3', 'libpng16.so.16', 'libjpeg.so.8', 'libfreetype.so.6', 'libharfbuzz.so.0', 'libcairo.so.2', 'libpango-1.0.so.0', 'libgtk-4.so.1', 'libQt6Core.so.6', 'libpython3.12.so.1.0', 'libnvidia-glcore.so.570.153', 'libudev.so.1', 'libinput.so.10', 'libdrm.so.2'];
          const HOME = ['.bashrc', '.bash_profile', '.bash_history', '.config/hypr/hyprland.conf', '.config/hypr/hyprpaper.conf', '.config/kitty/kitty.conf', '.config/waybar/config.jsonc', '.config/waybar/style.css', '.config/fastfetch/config.jsonc', '.config/wofi/style.css', '.config/Code/User/settings.json', '.local/share/fonts/JetBrainsMono-Regular.ttf', '.cache/fontconfig/' + Math.random().toString(16).slice(2, 10) + '-le64.cache-9', '.local/state/wireplumber/default-nodes', '.mozilla/firefox/profiles.ini']
          const DIRS = [
            ['/boot', () => '/boot/' + pick(['vmlinuz-linux', 'initramfs-linux.img', 'initramfs-linux-fallback.img', 'amd-ucode.img', 'grub/grub.cfg', 'grub/fonts/unicode.pf2', 'grub/x86_64-efi/' + pick(['normal', 'linux', 'ext2', 'fat', 'part_gpt']) + '.mod', 'EFI/BOOT/BOOTX64.EFI'])],
            ['/dev', () => '/dev/' + pick(['pts/' + num(4), 'nvme0n1', 'nvme0n1p' + (1 + +num(3)), 'tty' + num(12), 'null', 'random', 'shm', 'dri/card1', 'input/event' + num(20)]), 'Device or resource busy'],
            ['/etc', () => '/etc/' + pick(['pacman.conf', 'pacman.d/mirrorlist', 'fstab', 'hostname', 'hosts', 'passwd', 'shadow', 'group', 'sudoers', 'locale.conf', 'vconsole.conf', 'mkinitcpio.conf', 'default/grub', 'os-release', 'resolv.conf', 'ssh/sshd_config', 'systemd/system/' + pick(['NetworkManager', 'bluetooth', 'sshd', 'docker']) + '.service', 'X11/xorg.conf.d/00-keyboard.conf', 'udev/rules.d/99-arduino.rules', 'modprobe.d/nvidia.conf'])],
            ['/home', () => '/home/reko/' + pick(HOME)],
            ['/mnt', () => '/mnt/' + pick(['usb/.Trash-1000/info', 'usb/System Volume Information/IndexerVolumeGuid'])],
            ['/opt', () => '/opt/' + pick(['visual-studio-code/code', 'visual-studio-code/resources/app/package.json', 'rider/bin/rider.sh', 'android-studio/bin/studio.sh', 'discord/Discord', 'cuda/bin/nvcc'])],
            ['/proc', () => '/proc/' + pick([num(4000) + '/status', num(4000) + '/cmdline', num(4000) + '/environ', 'cpuinfo', 'meminfo', 'sys/kernel/hostname', 'net/dev']), 'Operation not permitted'],
            ['/root', () => '/root/' + pick(['.bash_history', '.bashrc', '.cache/yay/' + pick(['hyprshot', 'visual-studio-code-bin']) + '/PKGBUILD'])],
            ['/run', () => '/run/' + pick(['user/1000/wayland-1', 'user/1000/pipewire-0', 'user/1000/bus', 'systemd/journal/socket', 'dbus/system_bus_socket', 'NetworkManager/resolv.conf']), 'Device or resource busy'],
            ['/srv', () => '/srv/' + pick(['http/index.html', 'ftp/readme.txt'])],
            ['/sys', () => '/sys/' + pick(['class/backlight/amdgpu_bl1/brightness', 'class/power_supply/BAT1/capacity', 'devices/system/cpu/cpu' + num(12) + '/online', 'firmware/efi/efivars/Boot0000', 'kernel/mm/transparent_hugepage/enabled', 'module/nvidia/version']), 'Operation not permitted'],
            ['/tmp', () => '/tmp/' + pick(['.X11-unix/X0', 'hypr/.socket.sock', 'yay-' + num(9999), 'vscode-ipc-' + num(99999) + '.sock', 'tmp.' + Math.random().toString(36).slice(2, 12)])],
            ['/usr', () => '/usr/' + pick([
              'bin/' + pick(BIN), 'bin/' + pick(BIN), 'lib/' + pick(LIB), 'lib/' + pick(LIB),
              'lib/modules/6.17.2-arch1-1/kernel/drivers/' + pick(['gpu/drm/amd/amdgpu/amdgpu.ko.zst', 'net/wireless/mediatek/mt7921e.ko.zst', 'usb/serial/ch341.ko.zst', 'bluetooth/btusb.ko.zst', 'nvme/host/nvme.ko.zst']),
              'lib/python3.12/' + pick(['os.py', 'json/__init__.py', 'asyncio/events.py', 'site-packages/numpy/__init__.py', 'site-packages/requests/api.py']),
              'share/fonts/TTF/' + pick(['Poppins-Bold.ttf', 'PermanentMarker-Regular.ttf', 'JetBrainsMono-Bold.ttf', 'DejaVuSans.ttf']),
              'share/icons/hicolor/' + pick(['48x48', '128x128', 'scalable']) + '/apps/' + pick(BIN) + '.png',
              'share/man/man1/' + pick(BIN) + '.1.gz', 'include/' + pick(['stdio.h', 'stdlib.h', 'string.h', 'linux/input.h', 'GL/gl.h']),
              'share/wayland-sessions/hyprland.desktop', 'share/hypr/hyprland.conf'])],
            ['/var', () => '/var/' + pick(['log/pacman.log', 'log/journal/' + Math.random().toString(16).slice(2, 10) + '/system.journal', 'cache/pacman/pkg/' + pick(BIN) + '-' + (1 + +num(9)) + '.' + num(20) + '.' + num(9) + '-1-x86_64.pkg.tar.zst', 'lib/pacman/local/' + pick(BIN) + '-' + (1 + +num(9)) + '.' + num(9) + '-1/files', 'lib/systemd/random-seed', 'tmp/systemd-private-' + Math.random().toString(16).slice(2, 12)])]
          ];
          let d = 0, left = 0, lines = 0;
          const add = (txt, cls) => {
            out.append(el('span', cls || '', txt));
            if (++lines > 220) { out.children[1].remove(); lines--; }
          };
          const step = () => {
            if (document.hidden) return;
            for (let k = 1 + Math.floor(Math.random() * 3); k > 0; k--) {
              if (left <= 0) { // on to the next directory (after /var it begins all over again)
                const prev = DIRS[(d + DIRS.length - 1) % DIRS.length];
                if (d > 0 && !prev[2]) add(`removed directory '${prev[0]}'`, 'd');
                if (d === DIRS.length) { add("rm: cannot remove '/': Device or resource busy", 'e'); d = 0; }
                left = 20 + Math.floor(Math.random() * 60);
              }
              const [, gen, err] = DIRS[d];
              const path = gen();
              add(err ? `rm: cannot remove '${path}': ${err}` : `removed '${path}'`, err ? 'e' : '');
              if (--left <= 0) d++;
            }
            term.scrollTop = term.scrollHeight;
            if (seen && Math.random() < 0.6) try { ui.play('rmTick'); } catch (err) {}
            // the first removed line is out: "Removing the french language" achievement (once)
            if (!rmStarted) { rmStarted = true; document.dispatchEvent(new CustomEvent('reko:rmrf-run')); }
          };
          let rmStarted = false;
          // the command gets typed out key by key (like someone at the keyboard), Enter, the password prompt, the "password"
          // gets typed (nothing shows, like a real sudo prompt), then off it goes, forever
          const CMD = 'sudo rm -rf / --no-preserve-root';
          let n = 0;
          const key = () => {
            cmd.textContent = CMD.slice(0, ++n);
            if (seen) try { ui.play('tick', 2300 + Math.random() * 700, 0.04); } catch (err) {}
            if (n < CMD.length) { setTimeout(key, 45 + Math.random() * 70 + (CMD[n] === ' ' ? 60 : 0)); return; }
            setTimeout(() => {
              caret.remove();
              if (seen) try { ui.play('tick', 1500, 0.05); } catch (err) {}
              term.append(out);
              term.scrollTop = term.scrollHeight;
              setTimeout(() => {
                if (seen) try { ui.play('tick', 1500, 0.05); } catch (err) {}
                pw.after(el('span', 'd', ''));
                setInterval(step, 45);
              }, reduceMotion ? 0 : 1100);
            }, reduceMotion ? 0 : 350);
          };
          if (reduceMotion) { n = CMD.length - 1; key(); } else setTimeout(key, 300);
        });
        tin.addEventListener('input', () => {
          try { ui.play('tick', 2300 + Math.random() * 700, 0.04); } catch (err) {}
          // sudo: not on my machine. The word turns red, shakes, gets crossed out, then fades away; the terminal is locked meanwhile
          const m = /(^|\s)(sudo)$/i.exec(tin.value);
          if (!m || busy) return;
          busy = true;
          tin.readOnly = true;
          // swallow every key on the whole page until it's over (Space would otherwise scroll the page away)
          const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
          ['keydown', 'keypress', 'keyup'].forEach((t) => window.addEventListener(t, swallow, true));
          const pre = tin.value.slice(0, m.index + m[1].length);
          const show = el('span', 'term-sudo', pre), word = el('b', '', m[2]);
          show.append(word);
          tin.before(show);
          tin.style.display = 'none';
          try { ui.play('error'); } catch (err) {}
          const t = reduceMotion ? 0 : 1;
          setTimeout(() => { word.classList.add('cross'); try { ui.play('pencil', 0.35); } catch (err) {} }, 380 * t);
          setTimeout(() => word.classList.add('gone'), 850 * t);
          setTimeout(() => {
            show.remove();
            tin.value = pre;
            tin.style.display = '';
            tin.readOnly = false;
            busy = false;
            ['keydown', 'keypress', 'keyup'].forEach((t) => window.removeEventListener(t, swallow, true));
            tin.focus();
          }, 1200 * t);
        });
        tin.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (busy) return;
          const cmd = tin.value.trim(), name = cmd.split(/\s+/)[0];
          // clear: wipe the history, back to a fresh prompt (like the real one, it also clears the red ✗)
          if (name === 'clear') {
            try { ui.play('tick', 1500, 0.05); } catch (err) {}
            tin.value = '';
            const old = [...term.children].filter((n) => n !== live);
            const wipe = () => {
              old.forEach((n) => n.remove());
              live.classList.remove('err');
              term.scrollTop = 0;
              live.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: reduceMotion ? 0 : 320, easing: 'ease-out' });
              busy = false;
              tin.focus();
            };
            if (reduceMotion) { wipe(); return; }
            // everything slides up and fades away, last lines first, then the prompt fades back in on its own
            busy = true;
            const all = [...old, live], n = all.length;
            all.forEach((node, i) => node.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(2px)' }],
              { duration: 260, delay: Math.min(260, (n - 1 - i) * 40), easing: 'ease-in', fill: 'forwards' }));
            setTimeout(() => { all.forEach((node) => node.getAnimations().forEach((a) => a.cancel())); live.style.opacity = '0'; wipe(); live.style.opacity = ''; }, Math.min(260, (n - 1) * 40) + 300);
            return;
          }
          // shutdown / poweroff / reboot: the whole site switches off like an old TV (css .pwr, like the birdhouse's but
          // without the glitches) and stays black and silent; only a page refresh turns it back on. reboot switches it back
          // on and reloads the page, so it starts again with the intro. Nothing saved (achievements, sound...) is touched
          if (name === 'shutdown' || name === 'poweroff' || name === 'reboot') {
            const done = el('span', 'term-line' + (live.classList.contains('err') ? ' err' : ''));
            done.append($('.term-pill', live).cloneNode(true), $('.term-x', live).cloneNode(true), $('.term-arr', live).cloneNode(true), el('span', 'term-cmd ok', tin.value));
            term.insertBefore(done, live);
            tin.value = '';
            tin.blur();
            busy = true;
            try { ui.play('tick', 1500, 0.05); } catch (err) {}
            // Shutdown / Reboot achievements: remembered now, given after the intro of the next visit (see reko-power below)
            try { localStorage.setItem('reko-power-' + (name === 'reboot' ? 'reboot' : 'shutdown'), '1'); } catch (err) { /* storage blocked */ }
            powerOff(name === 'reboot');
            return;
          }
          const run = CMDS[name], bad = !!cmd && !run;
          try { ui.play(bad ? 'crash' : 'tick', 1500, 0.05); } catch (err) {}
          // freeze the typed line into the history (with the red ✗ if the last command failed), then print the output
          const done = el('span', 'term-line' + (live.classList.contains('err') ? ' err' : ''));
          done.append($('.term-pill', live).cloneNode(true), $('.term-x', live).cloneNode(true), $('.term-arr', live).cloneNode(true), el('span', 'term-cmd' + (run ? ' ok' : bad ? ' bad' : ''), tin.value));
          term.insertBefore(done, live);
          const out = run && run();
          if (out) { term.insertBefore(out, live); typeOut(out, () => { out.classList.add('ff-done'); document.dispatchEvent(new CustomEvent('reko:fetch')); }); } // fires once the whole output is typed out
          // unknown command: bash + ble.sh style error, shown at once (no typing), and the next prompt gets a red ✗
          if (bad) { const out = el('span', 'term-err'); out.append(el('span', '', `bash: ${name}: command not found`), el('span', 'term-exit', '[ble: exit 127]')); term.insertBefore(out, live); }
          if (cmd) live.classList.toggle('err', bad);
          tin.value = '';
          term.scrollTop = term.scrollHeight;
        });
      }
    }
  }
  $$('.logo-box').forEach(setupLogoBox);
});
