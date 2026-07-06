// app.js

let currentQuiz = {};
let lastQuizIndex = -1; 
let score = 0;
let timeLeft = 60;
let maxTime = 60; 
let timerInterval;

let inputStep = 0; 
let selectedDr = ""; 
let isVibrateEnabled = false;
let isReviewEnabled = false; 
let currentLevel = 1; 

let wrongQuizzes = [];

let isProcessing = false; // 1. ファイル上部で定義

window.onload = function() {
    loadSettings();
    showHistoryUI();
};

function toggleSettingsMenu() {
    const group = document.getElementById('settings-group');
    group.classList.toggle('open');
}

function saveSettings() {
    const timeVal = document.getElementById('time-select').value;
    localStorage.setItem('time_setting', timeVal);
}

function loadSettings() {
    const savedTime = localStorage.getItem('time_setting');

    if (savedTime !== null) document.getElementById('time-select').value = savedTime;
}

function saveResultToHistory(finalScore, settingTime) {
    let history = JSON.parse(localStorage.getItem('shiwake_history')) || [];
    history.unshift({ score: finalScore, time: settingTime, date: new Date().toLocaleDateString('ja-JP') });
    if (history.length > 5) history = history.slice(0, 5);
    localStorage.setItem('shiwake_history', JSON.stringify(history));
}

function showHistoryUI() {
    const historyList = document.getElementById('history-list');
    const history = JSON.parse(localStorage.getItem('shiwake_history')) || [];
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">まだ履歴がありません</div>';
        return;
    }
    
    history.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'history-item';
        itemEl.innerHTML = `
            <span>${index + 1}回前 (${item.time}秒)</span>
            <span style="color: #f1c40f; font-weight: bold;">${item.score} 問正解</span>
        `;
        historyList.appendChild(itemEl);
    });
}

function startGame() {
    maxTime = parseInt(document.getElementById('time-select').value, 10); 

    document.getElementById('start-screen').classList.add('hide');
    document.getElementById('play-screen').classList.remove('hide');
    
    score = 0;
    timeLeft = maxTime;
    lastQuizIndex = -1; 
    currentLevel = 1;
    wrongQuizzes = []; 
    
    document.getElementById('score').innerText = score;
    document.getElementById('timer').innerText = timeLeft;
    document.getElementById('level-badge').innerText = "LV.1 (8択)";
    document.getElementById('timer').classList.remove('danger-time');
    document.getElementById('progress-bar').classList.remove('danger-bar');
    
    setupButtons();
    nextQuestion();
    updateTimerUI(); 
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

function setupButtons(index) {
    const container = document.getElementById('btn-container');
    container.innerHTML = '';

    const currentQuiz = quizData[index];
    
    // ここで安全確認！
    if (!currentQuiz || !currentQuiz.options) {
        console.error("エラー！データが見つかりません。インデックス: " + index);
        return; 
    }

    container.className = "btn-container";

    // ここでシャッフル！
    const shuffledOptions = [...currentQuiz.options].sort(() => Math.random() - 0.5);

    // 安定したデータを使って表示
    shuffledOptions.forEach((optText) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerText = optText;
        btn.onclick = () => handleButtonClick(optText);
        container.appendChild(btn);
    });
}

function nextQuestion() {
    // データの総数を取得
    const totalQuizzes = quizData.length; 

    // レベル1は 0〜12番目（13問）、レベル2は 13番目〜最後（51-13 = 38問）
    let minIndex, maxIndex;
    if (currentLevel === 1) {
        minIndex = 0;
        maxIndex = 13; // 13未満 = 12まで
    } else {
        minIndex = 13;
        maxIndex = totalQuizzes; // データの最大数まで
    }

    // 範囲内でランダムなインデックスを決定
    let newIndex = Math.floor(Math.random() * (maxIndex - minIndex)) + minIndex;

    // もし前回と同じ問題ならもう一度選び直す（簡易的な重複防止）
    if (totalQuizzes > 1) {
        while (newIndex === lastQuizIndex) {
            newIndex = Math.floor(Math.random() * (maxIndex - minIndex)) + minIndex;
        }
    }

    lastQuizIndex = newIndex;
    currentQuiz = quizData[newIndex];

   // --- ここにリセット処理を追加 ---
    selectedDr = ""; 
    selectedCr = "";
    inputStep = 0; // 入力ステップも最初の状態に戻す

    // 表示更新
    document.getElementById('question-box').innerText = currentQuiz.q;
    setupButtons(newIndex);
    updateNavUI(); // これを呼ぶことで画面の表示も「入力待ち」に更新されます
}

function handleButtonClick(selectedText) {
    // 2. 処理中なら即座にストップ
    if (isProcessing) return;

    if (inputStep === 0) {
        selectedDr = selectedText;
        inputStep = 1;
        updateNavUI();
    } else if (inputStep === 1) {
        // 3. ここで処理開始フラグを立てる
        isProcessing = true;
        
        const selectedCr = selectedText;
        
        if (selectedDr === currentQuiz.dr && selectedCr === currentQuiz.cr) {
            score++;
            document.getElementById('score').innerText = score;

            if (score === 5 && currentLevel === 1) {
                currentLevel = 2;
                document.getElementById('level-badge').innerText = "LEVEL 2 (12択)";
            }

            const rewardTime = currentLevel === 1 ? 1 : 2;
            timeLeft += rewardTime; 
            if (timeLeft > maxTime) timeLeft = maxTime; 
            updateTimerUI();
            flashScreen('correct');
        } else {
            timeLeft -= 1;
            if (timeLeft < 0) timeLeft = 0;
            updateTimerUI();
            flashScreen('wrong');
            
            if (!wrongQuizzes.some(item => item.q === currentQuiz.q)) {
                wrongQuizzes.push(currentQuiz);
            }
        }

        // 4. 次の問題への移動を少しだけ遅らせて、その後にフラグを解除
        setTimeout(() => {
            nextQuestion();
            inputStep = 0; 
            isProcessing = false; // 処理完了
        }, 200); // 0.2秒の余韻
    }
}


function updateTimerUI() {
    document.getElementById('timer').innerText = timeLeft;
    const percentage = (timeLeft / maxTime) * 100;
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    if (timeLeft <= 10) {
        document.getElementById('timer').classList.add('danger-time');
        document.getElementById('progress-bar').classList.add('danger-bar');
    } else {
        document.getElementById('timer').classList.remove('danger-time');
        document.getElementById('progress-bar').classList.remove('danger-bar');
    }
}

function clearDrSelection() {
    inputStep = 0;
    selectedDr = "";
    updateNavUI();
}

function updateNavUI() {
    const slotDr = document.getElementById('slot-dr');
    const slotCr = document.getElementById('slot-cr');
    const clearBtn = document.getElementById('clear-btn');
    if (inputStep === 0) {
        slotDr.className = "nav-slot nav-active";
        slotDr.innerText = "借方(左): 入力待ち...";
        slotCr.className = "nav-slot";
        slotCr.innerText = "貸方(右): 待ち";
        clearBtn.classList.add('visibility-hidden');
    } else {
        slotDr.className = "nav-slot nav-filled";
        slotDr.innerText = `借方(左): 【${selectedDr}】`;
        slotCr.className = "nav-slot nav-active";
        slotCr.innerText = "貸方(右): 入力待ち...";
        clearBtn.classList.remove('visibility-hidden');
    }
}

function flashScreen(type) {
    const box = document.getElementById('question-box');
    const className = (type === 'correct') ? 'flash-correct' : 'flash-wrong';
    box.classList.add(className);
    setTimeout(() => box.classList.remove(className), 120);
}

function quitGame() {
    if (confirm("ゲームを中断してタイトル画面に戻りますか？\n（スコア履歴には記録されます）")) {
        clearInterval(timerInterval);
        saveResultToHistory(score, maxTime);
        location.reload(); 
    }
}

function endGame() {
    clearInterval(timerInterval);
    saveResultToHistory(score, maxTime);

    document.getElementById('play-screen').classList.add('hide');
    const resultScreen = document.getElementById('result-screen');
    if (resultScreen) {
        resultScreen.classList.remove('hide');
        document.getElementById('final-score').innerText = score;
    }

    // 間違えた問題がある場合だけボタンを表示
    if (wrongQuizzes.length > 0) {
        document.getElementById('review-btn').style.display = 'block';
    }
}

// 復習リストを表示する関数
function showReview() {
    const listDiv = document.getElementById('wrong-questions-list');
    listDiv.innerHTML = ''; 
    wrongQuizzes.forEach((quiz, index) => {
        const item = document.createElement('div');
        item.style.marginBottom = '15px';
        item.style.padding = '10px';
        item.style.background = '#3d3d3d';
        item.style.borderRadius = '8px';
        item.innerHTML = `
            <div style="color: #f1c40f;">Q${index + 1}: ${quiz.q}</div>
            <div style="margin-top: 5px;">借方: ${quiz.dr} / 貸方: ${quiz.cr}</div>
        `;
        listDiv.appendChild(item);
    });
    document.getElementById('review-modal').classList.remove('hide');
}

function hideReview() {
    document.getElementById('review-modal').classList.add('hide');
}