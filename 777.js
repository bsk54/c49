/*!
  Heptary Vertical Counter Picker
  - Info modal
  - CSV → pages build
  - Wheel picker rendering & interaction
*/
(function() {
  'use strict';



  //──────────────────────────
  // Part 1: Restore globals
  //──────────────────────────
  const G = window;
  G['777_fontSize']    = localStorage.getItem('777_fontSize')    !== null
    ? +localStorage.getItem('777_fontSize')    : 16;
  G['777_speechSpeed'] = localStorage.getItem('777_speechSpeed') !== null
    ? +localStorage.getItem('777_speechSpeed') : 1;
  G['777_pauseLength'] = localStorage.getItem('777_pauseLength') !== null
    ? +localStorage.getItem('777_pauseLength') : 1000;
  G['777_lastCard']    = localStorage.getItem('777_lastCard')    !== null
    ? +localStorage.getItem('777_lastCard')    : 1;
  G['777_language']    = localStorage.getItem('777_language')    || 'en';

  //──────────────────────────
  // Part 2: Info-Modal Helpers
  //──────────────────────────
  let infoTimeout;
  function showInfo(html, ms) {
    clearTimeout(infoTimeout);
    document.getElementById('infoBody').innerHTML = html;
    document.getElementById('infoModal').style.display = 'flex';
    if (ms) infoTimeout = setTimeout(closeInfo, ms);
  }
  function closeInfo() {
    clearTimeout(infoTimeout);
    document.getElementById('infoModal').style.display = 'none';
  }
  function attachModalListeners() {
    const modal    = document.getElementById('infoModal');
    const closeBtn = document.getElementById('infoCloseBtn');
    const content  = document.querySelector('#infoModal .modal-content');

    closeBtn.addEventListener('click', closeInfo);
    modal.addEventListener('click', closeInfo);
    content.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeInfo();
    });
  }

  //──────────────────────────
  // Part 3: On DOMContentLoaded
  //──────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // 3.1 Fetch & split info.html into grammarSections
    let grammarSections = [];
    fetch('info.html')
      .then(r => r.text())
      .then(txt => {
        grammarSections = txt
          .split(/^###\s*$/m)
          .map(s => s.trim())
          .filter(Boolean);
      });
	  
	  
	  
	  

    // 3.2 Load welcome messages from external file
    //    and display the one matching G['777_language']
    fetch('777messages.txt')
      .then(r => r.text())
      .then(txt => {
        const lines = txt.split(/\r?\n/);
        let inWelcome = false, lang = null, buf = [], msgs = {};
        for (let line of lines) {
          if (/^\[welcome\]/.test(line)) { inWelcome = true; continue; }
          if (!inWelcome) continue;
          let m = line.match(/^#([a-z]{2})/i);
          if (m) {
            if (lang && buf.length) msgs[lang] = buf.join('\n');
            lang = m[1].toLowerCase(); buf = [];
            continue;
          }
          if (lang && line.trim() !== '') buf.push(line);
        }
        if (lang && buf.length) msgs[lang] = buf.join('\n');
        const userLang = G['777_language'];
        const html = msgs[userLang] || msgs['en'] || '';
        if (html) showInfo(html, 5000);
      })
      .catch(console.error);

    attachModalListeners();

    // 3.3 Restore CSS variable for font size
    document.documentElement.style.setProperty(
      '--content-font-size',
      `${G['777_fontSize']}px`
    );

    // 3.4 Parse CSV and initialize app
Papa.parse('777.csv', {
  delimiter: ';',
  newline: '\n',
  quoteChar: '"',
  header: true,
  download: true,
  skipEmptyLines: true,
  complete: results => {
    // 1) build the pages, wheels, and everything else
    initApp(results.data);

  }
});




    //───────────────────────────────────────
    // Part 4: Build pages & wheels
    //───────────────────────────────────────
    function initApp(rows) {
      // 4.1 Build per-lesson pages
      const pages = [];
      const lastCat = {};
      rows.forEach(r => {
        const lid = parseInt(r['Lesson ID'], 10);
        if (!isFinite(lid)) return;
        const idx = lid - 1;
        pages[idx] = pages[idx] || { words: [], phrases: [] };
        if (r.Category) lastCat[idx] = r.Category.trim().toLowerCase();
        const cat = lastCat[idx];
        if (cat === 'words' || cat === 'phrases') {
          pages[idx][cat].push({
            chinese: r['Chinese'],
            pinyin: r['Pinyin'],
            translations: {
              en: r['English'],
              it: r['Italian'],
              fr: r['French'],
              es: r['Spanish'],
              de: r['German']
            }
          });
        }
      });
	  
  // Expose for the 49er module
  window.plWordsData   = pages.flatMap(p => p.words);
  window.plPhrasesData = pages.flatMap(p => p.phrases);
  

      // 4.2 Compute wheel dimensions
      const total = pages.length;
      const base = 7;
      const numW = Math.max(1, Math.ceil(Math.log(total) / Math.log(base)));
      let rem = total - 1, maxD = [];
      for (let i = 0; i < numW; i++) {
        const p = Math.pow(base, numW - 1 - i);
        maxD[i] = Math.floor(rem / p);
        rem %= p;
      }

      // 4.3 Render the wheels
      const counterEl = document.querySelector('.counter');
      const colors = ['red','blue','green','orange','yellow'].slice(-numW);
      counterEl.innerHTML = colors.map(c => `<div class="wheel ${c}"></div>`).join('');
      const wheels = Array.from(counterEl.children);
      const itemH = 45;

      // 4.4 Cache state & refs
      const display    = document.querySelector('.value-display');
      const cardDisp   = document.querySelector('.card-display');
      const tabs       = Array.from(document.querySelectorAll('.tab'));
      const langSelect = document.getElementById('langSelect');
      let lang         = G['777_language'];
      let curIdx       = Math.min(Math.max(0, G['777_lastCard'] - 1), total - 1);
      let curTab       = 'phrases';

      //──────────────────────────
      // Part 5: Navigation & Render
      //──────────────────────────
      function gotoIndex(idx) {
        curIdx = (idx + total) % total;
        localStorage.setItem('777_lastCard', `${curIdx + 1}`);

        // update wheels
        let x = curIdx, digits = Array(numW).fill(0);
        for (let k = 0; k < numW; k++) {
          if (k < numW - 1) {
            const p = Math.pow(base, numW - 1 - k);
            digits[k] = Math.floor(x / p);
            x %= p;
          } else {
            digits[k] = x + 1;
          }
        }
        digits.forEach((d, k) => {
          const wheel    = wheels[k];
          const prefixOK = digits.slice(0, k).every((v,i) => v === maxD[i]);
          const top      = k < numW - 1
            ? (prefixOK ? maxD[k] : base - 1)
            : (prefixOK ? maxD[k] + 1 : base);
          const allowed  = k < numW - 1
            ? Array.from({ length: top + 1 }, (_,n) => n)
            : Array.from({ length: top }, (_,n) => n + 1);
          wheel.innerHTML = allowed.map(v => `<div class="number">${v}</div>`).join('');
          wheel.scrollTop  = allowed.indexOf(d) * itemH;
        });

        render();
      }





/**
 * After you’ve done markActive(...), call this once
 * to make all of the quiz‐segment buttons interact.
 */
function attachQuizControlListeners() {
  const quizPanel = document.getElementById('qu-settingsPanel');

  // generic binder for any segmented control
  function bindSegment(id, storageKey) {
    quizPanel.querySelectorAll(`#${id} button`).forEach(btn => {
      btn.onclick = () => {
        // 1) remove active on siblings
        quizPanel.querySelectorAll(`#${id} button`)
                 .forEach(x => x.classList.remove('active'));
        // 2) mark this one
        btn.classList.add('active');
        // 3) persist
        localStorage.setItem(storageKey, btn.dataset.value);
      };
    });
  }

  bindSegment('qu-contentControl',  'qu-content');
  bindSegment('qu-poolControl',     'qu-wordsInPool');
  bindSegment('qu-playModeControl', 'qu-playMode');

  // Q/A toggles are on/off too:
  const qBtn = quizPanel.querySelector('#qu-toggleSpeakQ');
  qBtn.onclick = () => {
    const on = qBtn.classList.toggle('active');
    localStorage.setItem('qu-speakerQuestion', on ? '1' : '0');
  };

  const aBtn = quizPanel.querySelector('#qu-toggleSpeakA');
  aBtn.onclick = () => {
    const on = aBtn.classList.toggle('active');
    localStorage.setItem('qu-speakerAnswer', on ? '1' : '0');
  };
}





 function render() {
  // 0) Always hide the 49er and Quiz panels by default
  document.getElementById('pl-playback-module').style.display = 'none';
  document.getElementById('qu-settingsPanel').style.display   = 'none';


  // 1) Update counter and active tab highlighting
  display.textContent = `${curIdx + 1}/${total}`;
  tabs.forEach(t => t.classList.toggle('active', t.classList.contains(curTab)));

  // ──────────────────────────
  // 49er Tab
  // ──────────────────────────
  if (curTab === 'forty-nine') {
    // hide normal cards, show 49er module
    document.querySelector('.card-display').style.display       = 'none';
    document.getElementById('pl-playback-module').style.display = 'block';

    // compute the 49-item slice
    const allW  = pages.flatMap(p => p.words);
    const allP  = pages.flatMap(p => p.phrases);
    const grp   = Math.floor(curIdx / 7);
    const start = grp * 49, end = start + 49;
    const w49   = allW.slice(start, end);
    const p49   = allP.slice(start, end);

    // populate the static tables
    const module = document.getElementById('pl-playback-module');
    module.querySelector('#pl-wordTable').innerHTML = w49.map(e => `
      <tr data-word="${e.chinese}">
        <td>${e.chinese}</td>
        <td>${e.pinyin}</td>
        <td>${e.translations[lang]}</td>
      </tr>
    `).join('');
    module.querySelector('#pl-phraseTable').innerHTML = p49.map(e => `
      <tr data-word="${e.chinese}">
        <td>${e.chinese}</td>
        <td>${e.pinyin}</td>
        <td>${e.translations[lang]}</td>
      </tr>
    `).join('');

    // flatten for playback
    window.plWordsData   = w49.map(e => ({ chinese: e.chinese, pinyin: e.pinyin, translation: e.translations[lang] }));
    window.plPhrasesData = p49.map(e => ({ chinese: e.chinese, pinyin: e.pinyin, translation: e.translations[lang] }));

    return;
  }






// Quiz Tab
// ──────────────────────────
if (curTab === 'quiz') {
  // 1) Hide the normal cards, show the Quiz settings panel
  document.querySelector('.card-display').style.display = 'none';
  const quizPanel = document.getElementById('qu-settingsPanel');
  quizPanel.style.display = 'block';

  // 2) Highlight the current Quiz-settings buttons
  const savedContent  = localStorage.getItem('qu-content')       || '1';
  const savedPool     = +localStorage.getItem('qu-wordsInPool')  || 7;
  const savedPlayMode = localStorage.getItem('qu-playMode')      || '1';
  const savedSpeakQ   = localStorage.getItem('qu-speakerQuestion') === '1';
  const savedSpeakA   = localStorage.getItem('qu-speakerAnswer')   === '1';

  function markActive(seg, val) {
    quizPanel.querySelectorAll(`#${seg} button`)
             .forEach(b => b.classList.toggle('active', b.dataset.value === String(val)));
  }
  markActive('qu-contentControl',  savedContent);
  markActive('qu-poolControl',     savedPool);
  markActive('qu-playModeControl', savedPlayMode);
  quizPanel.querySelector('#qu-toggleSpeakQ')
    .classList.toggle('active', savedSpeakQ);
  quizPanel.querySelector('#qu-toggleSpeakA')
    .classList.toggle('active', savedSpeakA);

  // we'll store the chosen play mode here
  let quizMode;

  // 3) START button
  document.getElementById('qu-startBtn').onclick = () => {
    // capture play mode
    quizMode = quizPanel.querySelector('#qu-playModeControl .active').dataset.value;

    // read other settings
    const content  = quizPanel.querySelector('#qu-contentControl .active').dataset.value;
    const pool     = +quizPanel.querySelector('#qu-poolControl .active').dataset.value;
    const lang     = document.getElementById('langSelect').value;
    const isPhrase = content === '2';

    // build and slice master list
    const fullList = isPhrase
      ? pages.flatMap(p => p.phrases)
      : pages.flatMap(p => p.words);
    const perLesson = 7;
    const lesson    = Math.floor(curIdx);
    let startIndex, count;
    if (pool === 7) {
      startIndex = lesson * perLesson; count = perLesson;
    } else if (pool === 21) {
      startIndex = lesson * perLesson; count = 3 * perLesson;
    } else if (pool === 49) {
      const block = Math.floor((lesson * perLesson) / 49);
      startIndex = block * 49;          count = 49;
    } else {
      startIndex = lesson * perLesson;  count = pool;
    }
    count = Math.min(count, fullList.length - startIndex);

    // prepare quizList with metadata
    let quizList = fullList
      .slice(startIndex, startIndex + count)
      .map((item, i) => ({
        chinese:        item.chinese,
        pinyin:         item.pinyin,
        translations:   item.translations,
        absoluteNumber: startIndex + i + 1,
        error:          false,
        okCount:        0
      }));
    // shuffle
    for (let i = quizList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [quizList[i], quizList[j]] = [quizList[j], quizList[i]];
    }

    // 4) State & refs
    let currentIndex   = 0;
    let correctCount   = 0;
    let incorrectCount = 0;
    const quizWindow   = document.getElementById('qu-playback-window');
    const questionArea = document.getElementById('qu-question-area');
    const answerArea   = document.getElementById('qu-answer-area');
    const pictureArea  = document.getElementById('qu-picture-area');
    const counterDiv   = document.getElementById('qu-counters');

    // ** reset counter display on each new quiz start **
    counterDiv.textContent = '0 / 0';

    // 5) renderQuestion
    function renderQuestion() {
      const item = quizList[currentIndex];
      answerArea.innerHTML = '';  // always clear any old answer

      // question
      if (quizMode === '2') {
        questionArea.innerHTML = `
          <div class="question">
            <p class="quiz-translation">${item.translations[lang]}</p>
          </div>
        `;
      } else {
        questionArea.innerHTML = `
          <div class="question">
            <p class="quiz-chinese">${item.chinese}</p>
          </div>
        `;
      }

      // picture
      const picNum = String(item.absoluteNumber).padStart(5, '0');
      pictureArea.innerHTML = `
        <div class="picture">
          <img src="../WordSiren/wspics/${picNum}.jpg"
               alt="Image #${picNum} for ${item.chinese}" />
        </div>
      `;

      // buttons
      document.getElementById('qu-buttons-question').style.display = 'flex';
      document.getElementById('qu-buttons-answer'  ).style.display = 'none';
    }

    // show quiz UI
    quizWindow.style.display = 'flex';
    quizPanel.style.display  = 'none';
    renderQuestion();

    // exit helper
    function exitQuiz() {
      quizWindow.style.display = 'none';
      quizPanel.style.display  = 'block';
    }

    // escape to close
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        exitQuiz();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // wire exits
    document.getElementById('qu-exitBtn'      ).onclick = exitQuiz;
    document.getElementById('qu-exitAnswerBtn').onclick = exitQuiz;

    // 6) SHOW answer
    document.getElementById('qu-showBtn').onclick = () => {
      // ** SHOW does NOT change counters **
      const item = quizList[currentIndex];

      const answerHTML = quizMode === '2'
        ? `<p class="quiz-chinese">${item.chinese}</p>
           <p class="quiz-pinyin">${item.pinyin}</p>`
        : `<p class="quiz-translation">${item.translations[lang]}</p>
           <p class="quiz-pinyin">${item.pinyin}</p>`;

      const div = document.createElement('div');
      div.classList.add('answer');
      div.innerHTML = answerHTML;
      answerArea.appendChild(div);

      // TTS if enabled
      if (localStorage.getItem('qu-speakerAnswer') === '1') {
        const utt = new SpeechSynthesisUtterance(item.chinese);
        utt.lang = 'zh-CN';
        utt.rate = parseFloat(localStorage.getItem('qu-speed') || '1');
        speechSynthesis.speak(utt);
      }

      // flag error
      item.error = true;

      // swap panels
      document.getElementById('qu-buttons-question').style.display = 'none';
      document.getElementById('qu-buttons-answer'  ).style.display = 'flex';
    };

    // 7) OK button
    document.getElementById('qu-okBtn').onclick = () => {
      const item = quizList[currentIndex];
      item.okCount++;

      const removeNow = !item.error
        ? item.okCount > 1
        : item.okCount >= 2;

      if (removeNow) {
        quizList.splice(currentIndex, 1);
      } else {
        currentIndex++;
      }

      // increment correct counter and update the single counter div
      correctCount++;
      counterDiv.textContent = `${correctCount} / ${incorrectCount}`;

      if (currentIndex >= quizList.length) {
        exitQuiz();
      } else {
        renderQuestion();
      }
    };

    // 8) SHOW AGAIN
    document.getElementById('qu-showAgainBtn').onclick = () => {
      // move to end & flag error
      const [moved] = quizList.splice(currentIndex, 1);
      moved.error   = true;
      moved.okCount = 0;
      quizList.push(moved);

      // increment incorrect counter and update display
      incorrectCount++;
      counterDiv.textContent = `${correctCount} / ${incorrectCount}`;

      if (currentIndex >= quizList.length) {
        currentIndex = 0;
      }
      renderQuestion();
    };
  };

  attachQuizControlListeners();
  return;
}

// on any other tab, hide quiz settings
document.getElementById('qu-settingsPanel').style.display = 'none';




















  // ──────────────────────────
  // Grammar Tab
  // ──────────────────────────
  if (curTab === 'grammar') {
    // show the normal card‐display again
    document.querySelector('.card-display').style.display = '';
    // hide the 49er and Quiz panels (already handled at top)
    cardDisp.innerHTML = `<div class="section-header">Info</div>` +
      (grammarSections[curIdx] || '<p>No grammar.</p>');
    return;
  }

  // ──────────────────────────
  // Words / Phrases / Quiz fallback
  // ──────────────────────────
  // show normal cards
  document.querySelector('.card-display').style.display = 'block';
  const pageArr = pages[curIdx] || { words: [], phrases: [] };
  const arr     = pageArr[curTab] || [];
  const label   = curTab.charAt(0).toUpperCase() + curTab.slice(1);
  const seq     = arr.map(e => e.chinese).join('|');

  let html = `<div class="section-header">
                <button class="play-all" data-seq="${seq}">🔊</button>${label}
              </div><table>`;
  arr.forEach(e => {
    html += `<tr data-word="${e.chinese}">
               <td>${e.chinese}</td>
               <td>${e.pinyin}</td>
               <td>${e.translations[lang]}</td>
             </tr>`;
  });
  html += `</table>`;
  cardDisp.innerHTML = html;
}


      function speakSeq(seq) {
        let i = 0;
        (function next() {
          if (i >= seq.length) return;
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(seq[i]);
          u.lang = 'zh-CN';
          u.rate = G['777_speechSpeed'];
          u.onend = () => setTimeout(next, G['777_pauseLength']);
          speechSynthesis.speak(u);
          i++;
        })();
      }

      //──────────────────────────
      // Part 6: Wire up interactions
      //──────────────────────────

      document.querySelector('.prev').addEventListener('click', () => {
        speechSynthesis.cancel();
        gotoIndex(curIdx - 1);
      });
      document.querySelector('.next').addEventListener('click', () => {
        speechSynthesis.cancel();
        gotoIndex(curIdx + 1);
      });

      langSelect.value = lang;
      langSelect.addEventListener('change', e => {
        lang = e.target.value;
        localStorage.setItem('777_language', lang);
        render();
      });

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          speechSynthesis.cancel();
          curTab = Array.from(tab.classList)
            .find(c => ['words','phrases','quiz','forty-nine','grammar'].includes(c));
          render();
        });
      });

      document.body.addEventListener('click', e => {
        const row = e.target.closest('tr[data-word]');
        if (row) {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(row.dataset.word);
          u.lang = 'zh-CN';
          u.rate = G['777_speechSpeed'];
          speechSynthesis.speak(u);
        }
        if (e.target.matches('.play-all')) {
          speakSeq(e.target.dataset.seq.split('|'));
        }
      });

      wheels.forEach(wheel => {
        wheel.addEventListener('wheel', e => {
          e.preventDefault(); e.stopPropagation();
          speechSynthesis.cancel();
          gotoIndex(curIdx + (e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
      });

      wheels.forEach(wheel => {
        let dragging = false, startY, startScroll;
        wheel.addEventListener('pointerdown', e => {
          dragging = true;
          wheel.setPointerCapture(e.pointerId);
          startY = e.clientY;
          startScroll = wheel.scrollTop;
        });
        wheel.addEventListener('pointermove', e => {
          if (!dragging) return;
          wheel.scrollTop = startScroll - (e.clientY - startY);
        });
        ['pointerup','pointercancel','pointerleave'].forEach(evt => {
          wheel.addEventListener(evt, () => {
            if (!dragging) return;
            dragging = false;
            const snap = Math.round(wheel.scrollTop / itemH);
            wheel.scrollTop = snap * itemH;
            const ds = wheels.map(w =>
              parseInt(w.children[Math.round(w.scrollTop/itemH)].textContent, 10)
            );
            let ni = 0;
            ds.forEach((d,k) => {
              if (k < numW-1) ni += d * Math.pow(base, numW-1-k);
              else ni += d - 1;
            });
            gotoIndex(ni);
          });
        });
      });

// swipe to change tabs, but only when NOT in 49er‐playback
(() => {
  let sx, sy;
  const ce = document.querySelector('.content');
  const pw = document.getElementById('pl-playbackWindow');

  ce.addEventListener('touchstart', e => {
    // if playback window is visible, don’t start a swipe
    if (pw.style.display === 'block') return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });

  ce.addEventListener('touchend', e => {
    // if playback window is visible, don’t interpret a swipe
    if (pw.style.display === 'block') return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      speechSynthesis.cancel();
      const order = ['words','phrases','quiz','forty-nine','grammar'];
      let ti = order.indexOf(curTab);
      ti = (ti + (dx < 0 ? 1 : -1) + order.length) % order.length;
      curTab = order[ti];
      render();
    }
  }, { passive: true });
})();


      (() => {
        const btn = document.getElementById('hamburgerBtn');
        const menu = document.getElementById('hamburgerMenu');
        function toggleMenu(e) { e.stopPropagation(); menu.classList.toggle('open'); }
        function closeMenu() { menu.classList.remove('open'); }
        btn.addEventListener('click', toggleMenu);
        document.addEventListener('click', e => {
          if (!menu.contains(e.target) && e.target !== btn) closeMenu();
        });
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape') closeMenu();
        });
      })();


  // 1) force the first tab to be Phrases
  curTab = 'phrases';

  // 2) wire up the 49-item “Start” button
  init49erModule();

  // 3) now render that first “phrases” card
  gotoIndex(curIdx);

    }
  });
})();



function init49erModule() {
  const root = document.getElementById('pl-playback-module');
  if (!root) return;
  'use strict';

  //
  // ——— Dynamic Data ———————————————————————————————————————————
  //
  // const wordsData   = window.plWordsData   || [];
  // const phrasesData = window.plPhrasesData || [];

  //
  // ——— Settings & Storage Helpers ——————————————————————————————
  //
  
  
  // map two-letter codes to speech Synthesis locales
const localeMap = {
  en: 'en-US',
  it: 'it-IT',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE'
};

/**
 * Read the user’s chosen translation language and
 * return the best SpeechSynthesis locale.
 */
function getTranslationLocale() {
  const code = localStorage.getItem('777_language') || 'en';
  return localeMap[code] || 'en-US';
}




// ────────────────────────────────────────────────────────────
// Quiz localStorage setup
// ────────────────────────────────────────────────────────────

// 1) Define your defaults
const quizDefaults = {
  content:           '1',
  playMode:          '1',
  speed:             '1.0',
  speedTranslation:  '1.0',
  speakerQuestion:   '1',
  speakerAnswer:     '1',
  wordsInPool:       '7',
  fontSize:          '16'
};

// 2) Map your keys in localStorage
const quizKeys = {
  content:          'qu-content',
  playMode:         'qu-playMode',
  speed:            'qu-speed',
  speedTranslation: 'qu-speedTranslation',
  speakerQuestion:  'qu-speakerQuestion',
  speakerAnswer:    'qu-speakerAnswer',
  wordsInPool:      'qu-wordsInPool',
  fontSize:         'qu-fontSize'
};

// 3) Seed any missing values on first load
Object.keys(quizDefaults).forEach(k => {
  if (localStorage.getItem(quizKeys[k]) === null) {
    localStorage.setItem(quizKeys[k], quizDefaults[k]);
  }
});

// 4) Helper to read
function getQuizSetting(k) {
  const v = localStorage.getItem(quizKeys[k]);
  return v === null ? quizDefaults[k] : v;
}

// 5) Helper to write
function saveQuizSetting(k,v) {
  localStorage.setItem(quizKeys[k], v);
}




  const defaults = {
    content: '2',
    random: '1',
    playbackMode: '1',
    speakerQuestion: '1',
    speakerAnswer: '1',
    speed: '1.0',
    translationSpeed: '1.0',
    pauseLength: '2.0',
    fontSize: '16',
    speedSteps: ['1.0', '0.75', '0.5']
  };

  const keys = {
    content: 'pl-content',
    random: 'pl-random',
    playbackMode: 'pl-playbackMode',
    speakerQuestion: 'pl-speakerQuestion',
    speakerAnswer: 'pl-speakerAnswer',
    speed: 'pl-speed',
    translationSpeed: 'pl-translationSpeed',
    pauseLength: 'pl-pauseLength',
    fontSize: 'pl-fontSize'
  };

  const getSetting = k => localStorage.getItem(keys[k]) || defaults[k];
  const saveSetting = (k, v) => localStorage.setItem(keys[k], v);

  //
  // ——— State ————————————————————————————————————————————————
  //
  let originalList = [];
  let list         = [];
  let idxItem      = 0;
  let timerId      = null;
  let isPaused     = false;
  let sliderHideTimer;
  let longPressTimer;
  let editingTranslationSpeed = false;

  //
  // ——— Element References ————————————————————————————————————————
  //
  const els = {
    settingsPanel:  root.querySelector('#pl-settingsPanel'),
    playbackWindow: root.querySelector('#pl-playbackWindow'),
    playbackArea:   root.querySelector('#pl-playbackArea'),
    startBtn:       root.querySelector('#pl-startBtn'),
    closeBtn:       root.querySelector('#pl-closePlayback'),
    togglePlayPauseBtn: root.querySelector('#pl-togglePlayPause'),
    skipBtn:        root.querySelector('#pl-skipBtn'),
    skipBackBtn:    root.querySelector('#pl-skipBackBtn'),
    toggleSpeedBtn: root.querySelector('#pl-toggleSpeed'),
    poolInfo:       root.querySelector('#pl-poolInfo'),
    rightToolbar:   root.querySelector('#pl-right-toolbar'),
    middleToolbar:  root.querySelector('#pl-middle-toolbar'),
    bottomControls: root.querySelector('#pl-bottomControls'),
    bottomSliders:  root.querySelector('#pl-bottomSliders'),
    pauseControl:   root.querySelector('#pl-pauseControl'),
    fontControl:    root.querySelector('#pl-fontControl'),
    translationControl: root.querySelector('#pl-translationControl'),
    pauseSlider:    root.querySelector('#pl-pauseSliderBottom'),
    fontSlider:     root.querySelector('#pl-fontSliderBottom'),
    translationSlider: root.querySelector('#pl-translationSpeedSlider'),
    pauseValue:     root.querySelector('#pl-pauseValueBottom'),
    fontValue:      root.querySelector('#pl-fontValueBottom'),
    translationValue: root.querySelector('#pl-translationSpeedValue'),
    contentControl: root.querySelectorAll('#pl-contentControl button'),
    orderControl:   root.querySelectorAll('#pl-orderControl button'),
    audioQBtn:      root.querySelector('#pl-toggleSpeakQ'),
    audioABtn:      root.querySelector('#pl-toggleSpeakA'),
    sequenceControl: root.querySelectorAll('#pl-sequenceControl button')
  };

  //
  // ——— Utilities —————————————————————————————————————————————
  //
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function speakText(text, lang, rate) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = rate;
    function chooseVoice() {
      const voices = speechSynthesis.getVoices();
      const match = voices.find(v => v.lang === lang) ||
                    voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      if (match) utter.voice = match;
      speechSynthesis.speak(utter);
    }
    if (speechSynthesis.getVoices().length) chooseVoice();
    else speechSynthesis.onvoiceschanged = chooseVoice;
  }

  //
  // ——— View & Rendering ——————————————————————————————————————
  //
function updatePoolInfo(wordsData, phrasesData) {
  els.poolInfo.innerHTML = `
    <div>Words (${wordsData.length}): ${wordsData.map(d => d.chinese).join(', ')}</div>
    <div>Phrases (${phrasesData.length}): ${phrasesData.map(d => d.chinese).join(', ')}</div>
  `;
}

  els.poolInfo.innerHTML = ``;

function renderQuestion(item) {
  const mode = getSetting('playbackMode');
  const text = mode === '1'
    ? item.chinese
    : item.translation;

  els.playbackArea.innerHTML = `
    <div class="pl-number">${idxItem + 1}/${list.length}</div>
    <div class="pl-text${mode === '2' ? ' pl-translation' : ''}">${text}</div>
  `;
  bindQuestionClick();

  if (getSetting('speakerQuestion') === '1') {
    const rate = mode === '1'
      ? parseFloat(getSetting('speed'))
      : parseFloat(getSetting('translationSpeed'));

    // ── change is here ──
    const voiceLocale = mode === '1'
      ? 'zh-CN'
      : getTranslationLocale();

    speakText(text, voiceLocale, rate);
  }
}


function renderAnswer(item) {
  const mode = getSetting('playbackMode');

  const text = mode === '1'
    ? item.translation
    : item.chinese;

  const pinyin = item.pinyin;
  const cls    = mode === '1'
    ? 'pl-answer pl-translation'
    : 'pl-answer';

  els.playbackArea.innerHTML += `
    <div class="${cls}">${text}</div>
    <div class="pl-pinyin">${pinyin}</div>
  `;

  if (getSetting('speakerAnswer') === '1') {
    const rate = mode === '1'
      ? parseFloat(getSetting('translationSpeed'))
      : parseFloat(getSetting('speed'));

    // ── and here ──
    const voiceLocale = mode === '1'
      ? getTranslationLocale()
      : 'zh-CN';

    speakText(text, voiceLocale, rate);
  }
}














  function playNext() {
    if (isPaused) return;
    const item = list[idxItem];
    renderQuestion(item);
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      if (isPaused) return;
      renderAnswer(item);
      timerId = setTimeout(() => {
        idxItem = (idxItem + 1) % list.length;
        playNext();
      }, parseFloat(getSetting('pauseLength')) * 1000);
    }, parseFloat(getSetting('pauseLength')) * 1000);
  }

  //
  // ——— Actions ——————————————————————————————————————————————
  //
function startPlayback() {
	
  // hide the wheel and the main “Words/Phrases/…” tabs
  document.querySelector('.wheel-area').style.display = 'none';
  document.querySelector('.tabs').style.display      = 'none';
  document.querySelector('.card-display').style.display = 'none';	

  // 1) Grab the two slices you set in render()
  const wordsData   = window.plWordsData   || [];
  const phrasesData = window.plPhrasesData || [];

  // 2) Choose between them based on TYPE (W=1 or P=2)
  const useWords = getSetting('content') === '1';
  originalList   = useWords ? wordsData : phrasesData;

  // 3) Prepare the play list (shuffle or keep order)
  list = getSetting('random') === '1'
       ? shuffle(originalList)
       : originalList.slice();
  idxItem = 0;
  isPaused = false;

  // 4) Show the right controls & headers
  els.settingsPanel.style.display    = 'none';
  els.playbackWindow.style.display   = 'block';
  els.rightToolbar.style.display     = 'flex';
  els.middleToolbar.style.display    = 'flex';
  els.togglePlayPauseBtn.textContent = '⏸';
  els.bottomControls.style.display   = 'flex';

  // 5) Update header info (optional)
  updatePoolInfo(wordsData, phrasesData);

  // 6) Kick off the first item
  playNext();
}


  function stopPlayback() {
  // restore wheel and tabs when we leave playback
  document.querySelector('.wheel-area').style.display = '';
  document.querySelector('.tabs').style.display      = '';
  document.querySelector('.card-display').style.display = '';
    clearTimeout(timerId);
    speechSynthesis.cancel();
    els.playbackWindow.style.display = 'none';
    els.rightToolbar.style.display   = 'none';
    els.middleToolbar.style.display  = 'none';
    els.settingsPanel.style.display  = 'block';
    els.bottomControls.style.display = 'none';
	
	
  // hop back to the 49er tab
  const fortyNineTab = document.querySelector('.tab.forty-nine');
  if (fortyNineTab) fortyNineTab.click();
  
  }

  function togglePlayPause() {
    isPaused = !isPaused;
    if (isPaused) {
      clearTimeout(timerId);
      speechSynthesis.cancel();
      els.togglePlayPauseBtn.textContent = '▶';
    } else {
      els.togglePlayPauseBtn.textContent = '⏸';
      playNext();
    }
  }

  function bindQuestionClick() {
    const q = els.playbackArea.querySelector('.pl-text');
    if (!q) return;
    q.style.cursor = 'pointer';
    q.onclick = () => {
      clearTimeout(timerId);
      speechSynthesis.cancel();
      els.skipBackBtn.click();
      els.skipBtn.click();
    };
  }

function showBottomSlider(type) {
  clearTimeout(sliderHideTimer);

  // —–– Re-sync slider values on every open —––––
  if (type === 'pause') {
    const v = getSetting('pauseLength');
    els.pauseSlider.value      = v;
    els.pauseValue.textContent = v;
  } else if (type === 'font') {
    const v = getSetting('fontSize');
    els.fontSlider.value      = v;
    els.fontValue.textContent = v;
  } else if (type === 'translation') {
    const v = getSetting('translationSpeed');
    els.translationSlider.value      = v;
    els.translationValue.textContent = v + '×';
  }

  els.bottomSliders.style.display  = 'flex';
  els.pauseControl.style.display   = type === 'pause' ? 'block' : 'none';
  els.fontControl.style.display    = type === 'font'  ? 'block' : 'none';
  els.translationControl.style.display = type === 'translation' ? 'block' : 'none';

  sliderHideTimer = setTimeout(hideSliders, 3000);
}


  function hideSliders() {
    clearTimeout(sliderHideTimer);
    els.bottomSliders.style.display = 'none';
    editingTranslationSpeed = false;
  }

  //
  // ——— Initialization (was the old `init()`) ————————————————————————
  //
  function init() {
	  
	  
	    // 0) restore saved font-size before anything else
  const storedFont = getSetting('fontSize');               // pulls localStorage.getItem('pl-fontSize') or default
  els.fontSlider.value      = storedFont;                  // sync slider
  els.fontValue.textContent = storedFont;                  // show its label
  root.style.setProperty('--pl-base-font-size', storedFont + 'px'); // apply to module

  // 1) default audio toggles
  
  
  
    // default audio toggles
    saveSetting('speakerQuestion', '1');
    saveSetting('speakerAnswer', '1');
    els.audioQBtn.classList.add('active');
    els.audioABtn.classList.add('active');

    // slider labels
    els.pauseValue.textContent       = getSetting('pauseLength');
    els.fontValue.textContent        = getSetting('fontSize');
    els.translationValue.textContent = getSetting('translationSpeed') + '×';

    // button bindings
    els.startBtn.addEventListener('click', startPlayback);
    els.closeBtn.addEventListener('click', stopPlayback);
    els.togglePlayPauseBtn.addEventListener('click', togglePlayPause);
els.skipBackBtn.addEventListener('click', () => {
  clearTimeout(timerId);
  speechSynthesis.cancel();
  isPaused = false;
  idxItem = (idxItem - 1 + list.length) % list.length;
  playNext();
});
els.skipBtn.addEventListener('click', () => {
  clearTimeout(timerId);
  speechSynthesis.cancel();
  isPaused = false;
  idxItem = (idxItem + 1) % list.length;
  playNext();
});


    // speed toggle (short/long press)
    els.toggleSpeedBtn.addEventListener('click', () => {
      let idx = defaults.speedSteps.indexOf(getSetting('speed'));
      idx = (idx + 1) % defaults.speedSteps.length;
      saveSetting('speed', defaults.speedSteps[idx]);
      els.toggleSpeedBtn.textContent = defaults.speedSteps[idx] + '×';
    });
    els.toggleSpeedBtn.addEventListener('pointerdown', () => {
      longPressTimer = setTimeout(() => showBottomSlider('translation'), 500);
    });
    ['pointerup','pointercancel'].forEach(evt =>
      els.toggleSpeedBtn.addEventListener(evt, () => clearTimeout(longPressTimer))
    );

    // sliders
    els.pauseSlider.addEventListener('input', e => {
      saveSetting('pauseLength', e.target.value);
      els.pauseValue.textContent = e.target.value;
      showBottomSlider('pause');
    });
    els.fontSlider.addEventListener('input', e => {
      saveSetting('fontSize', e.target.value);
      els.fontValue.textContent = e.target.value;
      root.style.setProperty('--pl-base-font-size', e.target.value + 'px');
      showBottomSlider('font');
    });
    els.translationSlider.addEventListener('input', e => {
      saveSetting('translationSpeed', e.target.value);
      els.translationValue.textContent = e.target.value + '×';
      showBottomSlider('translation');
    });
    [els.pauseSlider, els.fontSlider, els.translationSlider].forEach(slider => {
      ['change','mouseup','touchend'].forEach(evt =>
        slider.addEventListener(evt, hideSliders)
      );
    });




// 1) On module init, highlight the right TYPE button:
const currentType = localStorage.getItem('pl-content') || '1'; 
els.contentControl.forEach(btn => {
  btn.classList.toggle('active', btn.dataset.value === currentType);
});

    // segmented controls: TYPE / ORDER / SEQUENCE / AUDIO toggles
// — inside init49erModule(), after your other segmented-control bindings —

// Re-bind the TYPE (W / P) buttons for live switching:
els.contentControl.forEach(btn => {
  btn.addEventListener('click', () => {
    // 1) store the new preference
    saveSetting('content', btn.dataset.value);
    // 2) highlight the active button
    els.contentControl.forEach(x => x.classList.toggle('active', x === btn));

    // 3) rebuild the playback list from the current 49 slice
    const wordsData   = window.plWordsData   || [];
    const phrasesData = window.plPhrasesData || [];
    const useWords    = getSetting('content') === '1'; 
    originalList      = useWords ? wordsData : phrasesData;
    list              = getSetting('random') === '1'
                      ? shuffle(originalList)
                      : originalList.slice();

    // 4) reset to the top of that new list and play
    idxItem = 0;
    playNext();
  });
});


// — inside init49erModule(), after setting up `originalList` and before you start playback —
// 1) highlight the initial ORDER button
const isRandom = getSetting('random') === '1';
els.orderControl.forEach(btn =>
  btn.classList.toggle('active', btn.dataset.value === (isRandom ? 'random' : 'ordered'))
);

// 2) bind ORDER buttons for live switching
els.orderControl.forEach(btn => {
  btn.addEventListener('click', () => {
    // a) store new preference
    const nowRandom = btn.dataset.value === 'random';
    saveSetting('random', nowRandom ? '1' : '0');
    // b) update UI
    els.orderControl.forEach(x => x.classList.toggle('active', x === btn));
    // c) rebuild the play list
    list = nowRandom
      ? shuffle(originalList)
      : originalList.slice();
    // d) reset and play
    idxItem = 0;
    playNext();
  });
});




    els.orderControl.forEach(btn => {
      const isRand = getSetting('random') === '1';
      if ((isRand && btn.dataset.value==='random') ||
          (!isRand && btn.dataset.value==='ordered')) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        saveSetting('random', btn.dataset.value==='random' ? '1' : '0');
        els.orderControl.forEach(x => x.classList.toggle('active', x===btn));
      });
    });
    els.sequenceControl.forEach(btn => {
      if (btn.dataset.value === getSetting('playbackMode')) btn.classList.add('active');
      btn.addEventListener('click', () => {
        saveSetting('playbackMode', btn.dataset.value);
        els.sequenceControl.forEach(x => x.classList.toggle('active', x===btn));
      });
    });
    els.audioQBtn.addEventListener('click', () => {
      const v = getSetting('speakerQuestion')==='1'?'0':'1';
      saveSetting('speakerQuestion', v);
      els.audioQBtn.classList.toggle('active', v==='1');
    });
    els.audioABtn.addEventListener('click', () => {
      const v = getSetting('speakerAnswer')==='1'?'0':'1';
      saveSetting('speakerAnswer', v);
      els.audioABtn.classList.toggle('active', v==='1');
    });

    // pills
    const pausePill = root.querySelector('#pl-togglePauseSlider');
    const fontPill  = root.querySelector('#pl-toggleFontSlider');
    pausePill.addEventListener('click', () => {
      showBottomSlider('pause');
      pausePill.classList.toggle('active');
      fontPill.classList.remove('active');
    });
    fontPill.addEventListener('click', () => {
      showBottomSlider('font');
      fontPill.classList.toggle('active');
      pausePill.classList.remove('active');
    });

    // close on Escape
// close 49er — unless the Quiz window is open
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;

  const quizWindow = document.getElementById('qu-playback-window');
  if (quizWindow && quizWindow.style.display === 'block') {
    // Quiz is open: don’t close 49er
    return;
  }

  // otherwise close 49er as before
  stopPlayback();
});

  }

  // — invoke immediately —
  init();
}

  
  
  
