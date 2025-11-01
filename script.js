// Version 2: Refined gameplay flow, fixed advanced attack handling, and added utility helpers.
(() => {
  const BOARD_LENGTH = 23;
  const HAND_SIZE = 5;
  const ROUNDS_TO_WIN = 5;

  const elements = {
    piste: document.getElementById('piste'),
    handP1: document.getElementById('hand-p1'),
    handP2: document.getElementById('hand-p2'),
    actionMessage: document.getElementById('action-message'),
    actionOptions: document.getElementById('action-options'),
    log: document.getElementById('log'),
    newGameBtn: document.getElementById('new-game-btn'),
    nextRoundBtn: document.getElementById('next-round-btn'),
    modeRadios: Array.from(document.querySelectorAll('input[name="mode"]')),
    scoreP1: document.getElementById('score-p1'),
    scoreP2: document.getElementById('score-p2')
  };

  const gameState = {
    mode: 'basic',
    round: 1,
    startingPlayer: 0,
    activePlayer: null,
    players: [
      { id: 0, name: 'Player 1', position: 0, score: 0, hand: [], mustPlayBeforeDraw: false },
      { id: 1, name: 'Player 2', position: BOARD_LENGTH - 1, score: 0, hand: [], mustPlayBeforeDraw: false }
    ],
    deck: [],
    discard: [],
    phase: 'idle',
    attackContext: null,
    pendingAdvance: null,
    deckExhausted: false,
    lastDrawer: null,
    finalAttackPending: false
  };

  function init() {
    buildBoard();
    elements.newGameBtn.addEventListener('click', startNewMatch);
    elements.nextRoundBtn.addEventListener('click', () => {
      if (gameState.phase === 'round-end') {
        startNextRound();
      }
    });

    elements.modeRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        gameState.mode = getSelectedMode();
        addLog(`Mode set to ${capitalize(gameState.mode)}.`, 'info');
      });
    });

    renderAll();
  }

  function buildBoard() {
    elements.piste.innerHTML = '';
    for (let i = 0; i < BOARD_LENGTH; i += 1) {
      const space = document.createElement('div');
      space.className = 'space';
      space.dataset.index = i;
      const index = document.createElement('span');
      index.className = 'index';
      index.textContent = i + 1;
      space.appendChild(index);
      elements.piste.appendChild(space);
    }
  }

  function getSelectedMode() {
    const selected = elements.modeRadios.find((radio) => radio.checked);
    return selected ? selected.value : 'basic';
  }

  function startNewMatch() {
    resetScores();
    gameState.round = 1;
    gameState.startingPlayer = 0;
    startRound();
    addLog('New match started. Good luck!', 'success');
  }

  function startNextRound() {
    if (gameState.players.some((player) => player.score >= ROUNDS_TO_WIN)) {
      addLog('Match already finished. Start a new match to continue.', 'warning');
      return;
    }
    gameState.round += 1;
    gameState.startingPlayer = 1 - gameState.startingPlayer;
    startRound();
    addLog(`Round ${gameState.round} begins. ${gameState.players[gameState.startingPlayer].name} leads.`, 'info');
  }

  function startRound() {
    gameState.mode = getSelectedMode();
    gameState.deck = buildDeck();
    gameState.discard = [];
    gameState.attackContext = null;
    gameState.pendingAdvance = null;
    gameState.deckExhausted = false;
    gameState.lastDrawer = null;
    gameState.finalAttackPending = false;
    gameState.phase = 'turn';
    gameState.activePlayer = gameState.startingPlayer;

    gameState.players.forEach((player, index) => {
      player.position = index === 0 ? 0 : BOARD_LENGTH - 1;
      player.hand = [];
      player.mustPlayBeforeDraw = false;
    });

    dealInitialHands();
    renderAll();
    updateActionMessage(`${currentPlayer().name} to play first this round.`);
  }

  function resetScores() {
    gameState.players.forEach((player) => {
      player.score = 0;
    });
    updateScoreMarkers();
  }

  function buildDeck() {
    const deck = [];
    for (let value = 1; value <= 5; value += 1) {
      for (let copies = 0; copies < 5; copies += 1) {
        deck.push(value);
      }
    }
    return shuffle(deck);
  }

  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function dealInitialHands() {
    for (let i = 0; i < HAND_SIZE; i += 1) {
      gameState.players.forEach((player) => {
        drawCard(player);
      });
    }
  }

  function drawCard(player) {
    if (gameState.deck.length === 0) {
      return null;
    }
    const card = gameState.deck.pop();
    player.hand.push(card);
    gameState.lastDrawer = player.id;
    if (gameState.deck.length === 0) {
      gameState.deckExhausted = true;
    }
    return card;
  }

  function currentPlayer() {
    return gameState.players[gameState.activePlayer];
  }

  function opponentOf(playerId) {
    return gameState.players[1 - playerId];
  }

  function renderAll() {
    renderBoard();
    renderHands();
    updateScoreMarkers();
    renderActionOptions();
  }

  function renderBoard() {
    const playerPositions = gameState.players.reduce((acc, player) => {
      acc[player.position] = player;
      return acc;
    }, {});

    Array.from(elements.piste.children).forEach((space) => {
      const index = Number(space.dataset.index);
      const existingPiece = space.querySelector('.piece');
      if (existingPiece) {
        existingPiece.remove();
      }
      const occupant = playerPositions[index];
      if (occupant) {
        const piece = document.createElement('div');
        piece.className = `piece player-${occupant.id}`;
        piece.textContent = occupant.id === 0 ? 'P1' : 'P2';
        space.appendChild(piece);
      }
    });
  }

  function renderHands() {
    [elements.handP1, elements.handP2].forEach((container) => {
      container.innerHTML = '';
    });

    gameState.players.forEach((player) => {
      const handContainer = player.id === 0 ? elements.handP1 : elements.handP2;
      player.hand.forEach((cardValue, index) => {
        const card = document.createElement('button');
        card.className = 'card';
        card.type = 'button';
        card.textContent = cardValue;
        card.dataset.player = player.id;
        card.dataset.index = index;
        const isActiveHand =
          (gameState.phase === 'turn' && gameState.activePlayer === player.id) ||
          (gameState.phase === 'attack-strengthen' && gameState.attackContext?.attackerId === player.id) ||
          (gameState.phase === 'await-parry' && gameState.attackContext?.defenderId === player.id) ||
          (gameState.phase === 'await-retreat-card' && gameState.attackContext?.defenderId === player.id) ||
          (gameState.phase === 'advance-attack' && gameState.pendingAdvance?.playerId === player.id) ||
          (gameState.phase === 'final-attack' && gameState.activePlayer === player.id) ||
          (gameState.phase === 'defender-turn' && gameState.activePlayer === player.id);

        if (!isActiveHand) {
          card.classList.add('disabled');
          card.disabled = true;
        }

        card.addEventListener('click', () => {
          if (!card.disabled) {
            handleCardSelection(player.id, index);
          }
        });
        handContainer.appendChild(card);
      });
    });
  }

  function updateScoreMarkers() {
    [elements.scoreP1, elements.scoreP2].forEach((marker) => {
      marker.innerHTML = '';
    });
    gameState.players.forEach((player) => {
      const marker = player.id === 0 ? elements.scoreP1 : elements.scoreP2;
      for (let i = 0; i < ROUNDS_TO_WIN; i += 1) {
        const span = document.createElement('span');
        if (i < player.score) {
          span.classList.add('active');
        }
        marker.appendChild(span);
      }
    });
  }

  function renderActionOptions(options = []) {
    elements.actionOptions.innerHTML = '';
    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.label;
      if (option.style === 'secondary') {
        button.classList.add('secondary');
      }
      if (option.disabled) {
        button.disabled = true;
      }
      button.addEventListener('click', option.onClick);
      elements.actionOptions.appendChild(button);
    });
  }

  function handleCardSelection(playerId, cardIndex) {
    const player = gameState.players[playerId];
    const cardValue = player.hand[cardIndex];

    if (gameState.pendingAdvance && gameState.phase === 'advance-attack') {
      if (playerId === gameState.pendingAdvance.playerId) {
        finalizeAdvanceAttack(player, cardIndex, cardValue);
      }
      return;
    }

    switch (gameState.phase) {
      case 'turn':
        if (gameState.activePlayer !== playerId) return;
        showTurnOptions(player, cardIndex, cardValue);
        break;
      case 'attack-strengthen':
        if (gameState.attackContext?.attackerId !== playerId) return;
        handleAttackStrengthen(cardIndex, cardValue);
        break;
      case 'await-parry':
      case 'await-retreat-card':
        if (gameState.attackContext?.defenderId !== playerId) return;
        handleParrySelection(cardIndex, cardValue);
        break;
      case 'final-attack':
        if (gameState.activePlayer !== playerId) return;
        attemptFinalAttack(cardIndex, cardValue);
        break;
      case 'defender-turn':
        if (gameState.activePlayer !== playerId) return;
        showTurnOptions(player, cardIndex, cardValue);
        break;
      default:
        break;
    }
  }

  function showTurnOptions(player, cardIndex, cardValue) {
    const opponent = opponentOf(player.id);
    const distance = Math.abs(player.position - opponent.position);
    const forwardDirection = player.id === 0 ? 1 : -1;
    const backwardDirection = -forwardDirection;

    const possibleActions = [];
    const cannotMove = gameState.deckExhausted;
    if (!cannotMove) {
      if (isMoveLegal(player, cardValue, forwardDirection)) {
        possibleActions.push({ label: `Move ${cardValue} forward`, action: () => movePlayer(player, cardIndex, cardValue, forwardDirection) });
      }
      if (isMoveLegal(player, cardValue, backwardDirection)) {
        possibleActions.push({ label: `Retreat ${cardValue}`, action: () => movePlayer(player, cardIndex, cardValue, backwardDirection) });
      }
    }

    if (distance === cardValue) {
      possibleActions.push({ label: `Attack with ${cardValue}`, action: () => initiateAttack(player, cardIndex, cardValue, { type: 'standard' }) });
    }

    if (gameState.mode === 'advanced' && !gameState.deckExhausted) {
      const allowAdvance = canAdvance(player, cardIndex, cardValue);
      if (allowAdvance) {
        possibleActions.push({ label: `Advance & Attack (use ${cardValue})`, action: () => initiateAdvance(player, cardIndex, cardValue) });
      }
    }

    if (possibleActions.length === 0) {
      updateActionMessage('No legal moves with that card. Choose another card.');
      renderActionOptions();
      return;
    }

    const actionButtons = possibleActions.map((item) => ({
      label: item.label,
      onClick: () => {
        renderActionOptions();
        item.action();
      }
    }));

    renderActionOptions(actionButtons);
    updateActionMessage(`${player.name}, choose an action for card ${cardValue}.`);
  }

  function isMoveLegal(player, cardValue, direction) {
    const opponent = opponentOf(player.id);
    const target = player.position + cardValue * direction;
    if (target < 0 || target >= BOARD_LENGTH) {
      return false;
    }
    if (direction > 0 && target >= opponent.position) {
      return false;
    }
    if (direction < 0 && target <= opponent.position) {
      return false;
    }
    return true;
  }

  function movePlayer(player, cardIndex, cardValue, direction) {
    removeCardFromHand(player, cardIndex);
    player.position += cardValue * direction;
    addToDiscard(cardValue);
    addLog(`${player.name} moves ${direction > 0 ? 'forward' : 'backward'} ${cardValue} spaces.`, 'info');
    renderBoard();
    endPlayerTurn(player);
  }

  function addToDiscard(cardValue) {
    gameState.discard.push(cardValue);
  }

  function removeCardFromHand(player, cardIndex) {
    player.hand.splice(cardIndex, 1);
  }

  function initiateAttack(player, cardIndex, cardValue, meta) {
    removeCardFromHand(player, cardIndex);
    gameState.attackContext = {
      type: meta.type,
      attackerId: player.id,
      defenderId: opponentOf(player.id).id,
      cards: [cardValue],
      total: cardValue,
      baseCard: cardValue
    };
    addToDiscard(cardValue);

    if (meta.type === 'advanced') {
      addLog(`${player.name} attempts an advance & attack with a ${cardValue}.`, 'info');
    } else {
      addLog(`${player.name} launches an attack with a ${cardValue}.`, 'info');
    }

    if (gameState.mode !== 'basic') {
      gameState.phase = 'attack-strengthen';
      updateActionMessage(`${player.name}, add identical cards to strengthen or finish attack.`);
      renderHands();
      renderActionOptions([
        {
          label: 'Finish attack',
          onClick: () => finalizeAttack()
        }
      ]);
    } else {
      finalizeAttack();
    }
  }

  function handleAttackStrengthen(cardIndex, cardValue) {
    const attacker = gameState.players[gameState.attackContext.attackerId];
    if (cardValue !== gameState.attackContext.baseCard) {
      updateActionMessage('Only identical cards can strengthen the attack.');
      return;
    }
    removeCardFromHand(attacker, cardIndex);
    gameState.attackContext.cards.push(cardValue);
    gameState.attackContext.total += cardValue;
    addToDiscard(cardValue);
    addLog(`${attacker.name} strengthens the attack with another ${cardValue}.`, 'info');
    renderHands();
  }

  function finalizeAttack() {
    const attacker = gameState.players[gameState.attackContext.attackerId];
    drawToHand(attacker);
    renderHands();

    const defender = gameState.players[gameState.attackContext.defenderId];
    if (gameState.mode === 'basic' && gameState.attackContext.type === 'standard') {
      addLog(`${attacker.name}'s attack lands a hit!`, 'success');
      concludeRound(attacker.id);
      return;
    }

    gameState.phase = 'await-parry';
    gameState.attackContext.parrySelection = [];
    renderActionOptions([
      {
        label: 'Parry (select cards)',
        onClick: () => updateActionMessage(`${defender.name}, select ${gameState.attackContext.cards.length} card(s) totaling ${gameState.attackContext.total}.`),
        style: 'secondary'
      },
      ...(gameState.mode === 'advanced' && gameState.attackContext.type === 'advanced'
        ? [
            {
              label: 'Retreat',
              onClick: () => initiateRetreat(defender)
            }
          ]
        : [])
    ]);
    updateActionMessage(`${defender.name}, parry the attack by selecting ${gameState.attackContext.cards.length} card(s) totaling ${gameState.attackContext.total}.`);
  }

  function initiateRetreat(defender) {
    gameState.phase = 'await-retreat-card';
    updateActionMessage(`${defender.name}, choose a card to retreat backward.`);
    renderActionOptions([
      {
        label: 'Cancel retreat',
        onClick: () => {
          gameState.phase = 'await-parry';
          updateActionMessage(`${defender.name}, parry the attack or retreat.`);
          renderActionOptions([
            {
              label: 'Parry (select cards)',
              onClick: () => updateActionMessage(`${defender.name}, select ${gameState.attackContext.cards.length} card(s) totaling ${gameState.attackContext.total}.`),
              style: 'secondary'
            }
          ]);
        },
        style: 'secondary'
      }
    ]);
  }

  function handleParrySelection(cardIndex, cardValue) {
    if (gameState.phase === 'await-retreat-card') {
      performRetreat(cardIndex, cardValue);
      return;
    }
    const context = gameState.attackContext;
    const defender = gameState.players[context.defenderId];
    context.parrySelection.push({ cardValue, cardIndex });

    const requiredCards = context.cards.length;
    const currentCount = context.parrySelection.length;
    const currentTotal = context.parrySelection.reduce((sum, card) => sum + card.cardValue, 0);

    if (currentCount === requiredCards) {
      if (currentTotal === context.total) {
        addLog(`${defender.name} parries successfully.`, 'success');
        resolveParry();
      } else {
        addLog(`${defender.name} fails to meet the attack value.`, 'danger');
        discardParrySelection(defender, context.parrySelection);
        concludeRound(context.attackerId);
      }
    } else {
      updateActionMessage(`${defender.name}, select ${requiredCards - currentCount} more card(s) totaling ${context.total - currentTotal}.`);
    }
  }

  function discardParrySelection(defender, selection) {
    selection
      .sort((a, b) => b.cardIndex - a.cardIndex)
      .forEach((item) => {
        removeCardFromHand(defender, item.cardIndex);
        addToDiscard(item.cardValue);
      });
    renderHands();
  }

  function performRetreat(cardIndex, cardValue) {
    const context = gameState.attackContext;
    const defender = gameState.players[context.defenderId];
    const direction = defender.id === 0 ? -1 : 1;
    if (!isMoveLegal(defender, cardValue, direction)) {
      updateActionMessage('Retreat not possible with that card. Choose another.');
      return;
    }
    removeCardFromHand(defender, cardIndex);
    defender.position += cardValue * direction;
    addToDiscard(cardValue);
    addLog(`${defender.name} retreats ${cardValue} space(s) to avoid the attack.`, 'warning');
    drawToHand(defender);
    gameState.phase = 'turn';
    gameState.attackContext = null;
    gameState.pendingAdvance = null;
    renderHands();
    renderBoard();
    updateActionMessage(`${currentPlayer().name} retains initiative after the retreat.`);
    renderActionOptions();
  }

  function resolveParry() {
    const context = gameState.attackContext;
    const defender = gameState.players[context.defenderId];

    discardParrySelection(defender, context.parrySelection);

    defender.mustPlayBeforeDraw = true;
    gameState.phase = 'defender-turn';
    gameState.activePlayer = defender.id;
    gameState.attackContext = null;
    gameState.pendingAdvance = null;
    updateActionMessage(`${defender.name}, take your turn before drawing new cards.`);
    renderActionOptions();
  }

  function initiateAdvance(player, cardIndex, cardValue) {
    removeCardFromHand(player, cardIndex);
    addToDiscard(cardValue);
    const direction = player.id === 0 ? 1 : -1;
    player.position += cardValue * direction;
    addLog(`${player.name} advances ${cardValue} spaces.`, 'info');
    gameState.pendingAdvance = { playerId: player.id, moveDistance: cardValue };
    gameState.phase = 'advance-attack';
    updateActionMessage(`${player.name}, choose a card to complete the attack.`);
    renderHands();

    renderActionOptions([
      {
        label: 'Cancel advance',
        onClick: () => cancelAdvance(player, cardValue)
      }
    ]);
    renderBoard();
  }

  function cancelAdvance(player, cardValue) {
    const direction = player.id === 0 ? 1 : -1;
    player.position -= cardValue * direction;
    player.hand.push(cardValue);
    removeLastDiscard();
    gameState.pendingAdvance = null;
    gameState.phase = 'turn';
    addLog(`${player.name} cancels the advance.`, 'warning');
    renderBoard();
    renderHands();
    updateActionMessage(`${player.name}, select another action.`);
    renderActionOptions();
  }

  function removeLastDiscard() {
    gameState.discard.pop();
  }

  function canAdvance(player, cardIndex, cardValue) {
    const direction = player.id === 0 ? 1 : -1;
    if (!isMoveLegal(player, cardValue, direction)) {
      return false;
    }
    const opponent = opponentOf(player.id);
    const targetPosition = player.position + cardValue * direction;
    const distanceAfterAdvance = Math.abs(targetPosition - opponent.position);
    return player.hand.some((value, idx) => idx !== cardIndex && value === distanceAfterAdvance);
  }

  function finalizeAdvanceAttack(player, cardIndex, cardValue) {
    const opponent = opponentOf(player.id);
    const distance = Math.abs(player.position - opponent.position);
    if (cardValue !== distance) {
      updateActionMessage('Advance attack requires the second card to match the distance.');
      return;
    }
    gameState.phase = 'turn';
    gameState.pendingAdvance = null;
    initiateAttack(player, cardIndex, cardValue, { type: 'advanced' });
  }

  function attemptFinalAttack(cardIndex, cardValue) {
    const player = currentPlayer();
    const opponent = opponentOf(player.id);
    const distance = Math.abs(player.position - opponent.position);
    if (cardValue !== distance) {
      updateActionMessage('Final attack must match the distance exactly. Choose another card or pass.');
      return;
    }
    gameState.finalAttackPending = false;
    initiateAttack(player, cardIndex, cardValue, { type: 'standard' });
  }

  function endPlayerTurn(player) {
    if (checkNoLegalMoves(opponentOf(player.id).id)) {
      addLog(`${opponentOf(player.id).name} cannot move. ${player.name} wins the round.`, 'success');
      concludeRound(player.id);
      return;
    }

    drawIfAllowed(player);
    renderHands();

    if (gameState.deckExhausted && !gameState.finalAttackPending) {
      triggerFinalAttackPhase(player.id);
      return;
    }

    gameState.activePlayer = opponentOf(player.id).id;
    gameState.phase = 'turn';
    updateActionMessage(`${currentPlayer().name}, it's your turn.`);
    renderActionOptions();
    renderBoard();
  }

  function drawIfAllowed(player) {
    if (player.mustPlayBeforeDraw) {
      player.mustPlayBeforeDraw = false;
      return;
    }
    while (player.hand.length < HAND_SIZE && gameState.deck.length > 0) {
      drawCard(player);
    }
  }

  function checkNoLegalMoves(playerId) {
    const player = gameState.players[playerId];
    if (gameState.deckExhausted) {
      return false;
    }
    return !player.hand.some((cardValue) => {
      const forward = player.id === 0 ? 1 : -1;
      const backward = -forward;
      return (
        isMoveLegal(player, cardValue, forward) ||
        isMoveLegal(player, cardValue, backward) ||
        Math.abs(player.position - opponentOf(player.id).position) === cardValue
      );
    });
  }

  function triggerFinalAttackPhase(lastPlayerId) {
    const opponent = opponentOf(lastPlayerId);
    gameState.finalAttackPending = true;
    gameState.phase = 'final-attack';
    gameState.activePlayer = opponent.id;
    renderActionOptions([
      {
        label: 'Pass',
        onClick: () => resolveDeckDepletion()
      }
    ]);
    updateActionMessage(`${opponent.name}, last chance to attack! Play a matching card or pass.`);
  }

  function resolveDeckDepletion() {
    gameState.finalAttackPending = false;
    if (gameState.mode !== 'basic') {
      const attackGap = Math.abs(gameState.players[0].position - gameState.players[1].position);
      const attackCounts = gameState.players.map((player) =>
        player.hand.filter((card) => card === attackGap).length
      );
      if (attackCounts[0] !== attackCounts[1]) {
        const winner = attackCounts[0] > attackCounts[1] ? 0 : 1;
        addLog(`${gameState.players[winner].name} wins by having more potential attacks after deck exhaustion.`, 'success');
        concludeRound(winner);
        return;
      }
    }

    const distances = gameState.players.map((player, index) =>
      index === 0 ? player.position : BOARD_LENGTH - 1 - player.position
    );
    if (distances[0] === distances[1]) {
      addLog('Round ends in a draw after deck exhaustion.', 'warning');
      concludeRound(null);
      return;
    }
    const winner = distances[0] > distances[1] ? 0 : 1;
    addLog(`${gameState.players[winner].name} wins the round by advancing further.`, 'success');
    concludeRound(winner);
  }

  function concludeRound(winnerId) {
    gameState.phase = 'round-end';
    gameState.attackContext = null;
    gameState.pendingAdvance = null;
    gameState.finalAttackPending = false;
    renderActionOptions();
    if (winnerId === null) {
      updateActionMessage('Round drawn. Start the next round when ready.');
    } else {
      gameState.players[winnerId].score += 1;
      updateScoreMarkers();
      updateActionMessage(`${gameState.players[winnerId].name} wins the round!`);
      if (gameState.players[winnerId].score >= ROUNDS_TO_WIN) {
        addLog(`${gameState.players[winnerId].name} wins the match!`, 'success');
        updateActionMessage(`${gameState.players[winnerId].name} wins the match! Start a new match to play again.`);
      }
    }
  }

  function drawToHand(player) {
    while (player.hand.length < HAND_SIZE && gameState.deck.length > 0) {
      drawCard(player);
    }
  }

  function updateActionMessage(message) {
    elements.actionMessage.textContent = message;
  }

  function addLog(message, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.textContent = `[Round ${gameState.round}] ${message}`;
    elements.log.prepend(entry);
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  init();
})();
