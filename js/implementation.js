const state = {
    vertexCount: 5,
    source: 0,
    target: 4,
    edges: [
        { u: 1, v: 3, w: 2 },
        { u: 4, v: 3, w: -1 },
        { u: 2, v: 4, w: 1 },
        { u: 1, v: 2, w: 1 },
        { u: 0, v: 1, w: 5 }
    ],
    lastRun: null,
    educationalMode: false,
    selectedPass: -1,
    isAnimating: false,
    animationTimer: null,
    animationDelay: 850
};

const elements = {
    vertexCount: document.querySelector('#vertex-count'),
    source: document.querySelector('#source-node'),
    target: document.querySelector('#target-node'),
    edgeRows: document.querySelector('#edge-rows'),
    runBtn: document.querySelector('#run-btn'),
    addEdgeBtn: document.querySelector('#add-edge-btn'),
    clearEdgesBtn: document.querySelector('#clear-edges-btn'),
    sampleBtn: document.querySelector('#sample-btn'),
    summary: document.querySelector('#summary'),
    educationalMode: document.querySelector('#educational-mode'),
    passControls: document.querySelector('#pass-controls'),
    passPrev: document.querySelector('#pass-prev'),
    passNext: document.querySelector('#pass-next'),
    passSelect: document.querySelector('#pass-select'),
    passSummary: document.querySelector('#pass-summary'),
    educationalExplanation: document.querySelector('#educational-explanation'),
    distanceTable: document.querySelector('#distance-table'),
    logTable: document.querySelector('#log-table'),
    canvas: document.querySelector('#graph-canvas')
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function populateNodeSelect(selectEl, selectedValue) {
    selectEl.innerHTML = '';
    for (let i = 0; i < state.vertexCount; i++) {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = `Node ${i}`;
        if (i === selectedValue) {
            option.selected = true;
        }
        selectEl.appendChild(option);
    }
}

function sanitizeEdgesForVertexCount() {
    const maxNode = state.vertexCount - 1;
    state.edges = state.edges.map((edge) => ({
        u: clamp(Number(edge.u), 0, maxNode),
        v: clamp(Number(edge.v), 0, maxNode),
        w: Number(edge.w)
    }));
}

function readStateFromControls() {
    state.vertexCount = clamp(Number(elements.vertexCount.value) || 2, 2, 30);
    elements.vertexCount.value = String(state.vertexCount);

    state.source = clamp(Number(elements.source.value) || 0, 0, state.vertexCount - 1);
    state.target = clamp(Number(elements.target.value) || 0, 0, state.vertexCount - 1);

    const rows = Array.from(elements.edgeRows.querySelectorAll('.edge-row'));
    state.edges = rows.map((row) => {
        const u = Number(row.querySelector('.edge-u').value);
        const v = Number(row.querySelector('.edge-v').value);
        const w = Number(row.querySelector('.edge-w').value);
        return { u, v, w: Number.isFinite(w) ? w : 0 };
    });
}

function stopAnimation() {
    if (state.animationTimer) {
        clearInterval(state.animationTimer);
        state.animationTimer = null;
    }
    state.isAnimating = false;
}

function getInitialDistanceState() {
    const initial = new Array(state.vertexCount).fill(Number.POSITIVE_INFINITY);
    initial[state.source] = 0;
    return initial;
}

function createEdgeRow(edge, index) {
    const row = document.createElement('div');
    row.className = 'edge-row';
    row.dataset.index = String(index);

    const uSelect = document.createElement('select');
    uSelect.className = 'edge-u';

    const vSelect = document.createElement('select');
    vSelect.className = 'edge-v';

    for (let i = 0; i < state.vertexCount; i++) {
        const uOption = document.createElement('option');
        uOption.value = String(i);
        uOption.textContent = `u:${i}`;
        if (i === edge.u) {
            uOption.selected = true;
        }
        uSelect.appendChild(uOption);

        const vOption = document.createElement('option');
        vOption.value = String(i);
        vOption.textContent = `v:${i}`;
        if (i === edge.v) {
            vOption.selected = true;
        }
        vSelect.appendChild(vOption);
    }

    const weightInput = document.createElement('input');
    weightInput.className = 'edge-w';
    weightInput.type = 'number';
    weightInput.step = 'any';
    weightInput.value = String(edge.w);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        state.edges.splice(index, 1);
        renderEdgeRows();
        drawGraph();
    });

    [uSelect, vSelect, weightInput].forEach((control) => {
        control.addEventListener('change', () => {
            readStateFromControls();
            drawGraph();
        });
        control.addEventListener('input', () => {
            readStateFromControls();
            drawGraph();
        });
    });

    row.appendChild(uSelect);
    row.appendChild(vSelect);
    row.appendChild(weightInput);
    row.appendChild(removeBtn);
    return row;
}

function renderEdgeRows() {
    sanitizeEdgesForVertexCount();
    elements.edgeRows.innerHTML = '';

    if (state.edges.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'hint';
        empty.textContent = 'No edges yet. Add at least one directed edge.';
        elements.edgeRows.appendChild(empty);
        return;
    }

    state.edges.forEach((edge, index) => {
        elements.edgeRows.appendChild(createEdgeRow(edge, index));
    });
}

function renderSelectors() {
    populateNodeSelect(elements.source, state.source);
    populateNodeSelect(elements.target, state.target);
}

function reconstructPath(prev, source, target) {
    if (source === target) {
        return [source];
    }

    const path = [];
    const seen = new Set();
    let current = target;

    while (current !== null && current !== undefined) {
        if (seen.has(current)) {
            return [];
        }
        seen.add(current);
        path.push(current);
        if (current === source) {
            path.reverse();
            return path;
        }
        current = prev[current];
    }

    return [];
}

function runBellmanFord(vertexCount, edges, source) {
    const INF = Number.POSITIVE_INFINITY;
    const dist = new Array(vertexCount).fill(INF);
    const prev = new Array(vertexCount).fill(null);
    const logs = [];
    const passSnapshots = [];

    dist[source] = 0;

    passSnapshots.push({
        pass: 0,
        label: 'Initialization',
        dist: [...dist],
        prev: [...prev],
        relaxedEdgeIndices: []
    });

    // Step 1: Relax all edges exactly V-1 times.
    for (let i = 0; i < vertexCount - 1; i++) {
        const relaxedEdgeIndices = [];

        for (let eIndex = 0; eIndex < edges.length; eIndex++) {
            const edge = edges[eIndex];
            const u = edge.u;
            const v = edge.v;
            const w = edge.w;

            if (dist[u] !== INF && dist[u] + w < dist[v]) {
                const oldDistance = dist[v];
                dist[v] = dist[u] + w;
                prev[v] = u;
                relaxedEdgeIndices.push(eIndex);

                logs.push({
                    pass: i + 1,
                    edgeIndex: eIndex,
                    u,
                    v,
                    w,
                    oldDistance,
                    newDistance: dist[v]
                });
            }
        }

        passSnapshots.push({
            pass: i + 1,
            label: `Pass ${i + 1}`,
            dist: [...dist],
            prev: [...prev],
            relaxedEdgeIndices
        });
    }

    // Step 2: One extra pass to detect negative cycles.
    for (let eIndex = 0; eIndex < edges.length; eIndex++) {
        const edge = edges[eIndex];
        const u = edge.u;
        const v = edge.v;
        const w = edge.w;

        if (dist[u] !== INF && dist[u] + w < dist[v]) {
            return {
                negativeCycle: true,
                dist,
                prev,
                logs,
                offendingEdge: eIndex,
                passSnapshots,
                detectionPassRelaxed: [eIndex]
            };
        }
    }

    return {
        negativeCycle: false,
        dist,
        prev,
        logs,
        offendingEdge: -1,
        passSnapshots,
        detectionPassRelaxed: []
    };
}

function getActiveSnapshot() {
    if (!state.lastRun) {
        return null;
    }

    if (state.selectedPass === -1) {
        return {
            label: 'Final result',
            dist: state.lastRun.dist,
            prev: state.lastRun.prev,
            relaxedEdgeIndices: [],
            isFinal: true
        };
    }

    if (state.selectedPass >= 0 && state.selectedPass < state.lastRun.passSnapshots.length) {
        const snapshot = state.lastRun.passSnapshots[state.selectedPass];
        return {
            label: `Pass ${snapshot.pass} of ${Math.max(1, state.vertexCount - 1)}`,
            dist: snapshot.dist,
            prev: snapshot.prev,
            relaxedEdgeIndices: snapshot.relaxedEdgeIndices,
            isFinal: false
        };
    }

    return null;
}

function renderPassControls() {
    const hasRun = Boolean(state.lastRun);
    const hasSnapshots = hasRun && state.lastRun.passSnapshots.length > 0;

    elements.passSelect.innerHTML = '';

    const finalOption = document.createElement('option');
    finalOption.value = '-1';
    finalOption.textContent = 'Final result';
    elements.passSelect.appendChild(finalOption);

    if (hasSnapshots) {
        state.lastRun.passSnapshots.forEach((snapshot, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = snapshot.pass === 0 ? 'Initialization' : `Pass ${snapshot.pass}`;
            elements.passSelect.appendChild(option);
        });
    }

    elements.passSelect.value = String(state.selectedPass);

    const disabled = !hasRun || !state.educationalMode;
    elements.passSelect.disabled = disabled;
    elements.passPrev.disabled = disabled;
    elements.passNext.disabled = disabled;
}

function renderEducationalExplanation() {
    if (!state.lastRun) {
        elements.educationalExplanation.innerHTML =
            '<p><strong>What Bellman-Ford does:</strong> It computes shortest distances from one source node to every node, then runs one extra pass to detect negative cycles.</p>' +
            '<p>Run the algorithm to see each pass explained.</p>';
        return;
    }

    const snapshot = getActiveSnapshot();
    if (!snapshot) {
        elements.educationalExplanation.innerHTML = '<p>No snapshot is available for this selection.</p>';
        return;
    }

    if (snapshot.isFinal) {
        if (state.lastRun.negativeCycle) {
            elements.educationalExplanation.innerHTML =
                '<p><strong>Final interpretation:</strong> During the extra detection pass, at least one edge could still improve a distance.</p>' +
                '<p>This means a reachable negative cycle exists, so shortest paths are not well-defined.</p>';
            return;
        }

        const reachable = snapshot.dist.filter((d) => Number.isFinite(d)).length;
        elements.educationalExplanation.innerHTML =
            `<p><strong>Final interpretation:</strong> After ${Math.max(1, state.vertexCount - 1)} passes, distances stabilized.</p>` +
            `<p>Reachable nodes from source <strong>${state.source}</strong>: <strong>${reachable}/${state.vertexCount}</strong>. The extra pass found no negative cycle.</p>`;
        return;
    }

    if (snapshot.pass === 0) {
        elements.educationalExplanation.innerHTML =
            `<p><strong>Initialization:</strong> Source node <strong>${state.source}</strong> is set to <strong>0</strong>, all others are <strong>INF</strong>.</p>` +
            '<p>Now each next pass will attempt to relax every edge once.</p>';
        return;
    }

    const prevSnapshot = state.lastRun.passSnapshots[Math.max(0, state.selectedPass - 1)];
    const changedNodes = [];
    if (prevSnapshot) {
        for (let node = 0; node < snapshot.dist.length; node++) {
            if (snapshot.dist[node] !== prevSnapshot.dist[node]) {
                changedNodes.push(node);
            }
        }
    }

    const relaxedItems = snapshot.relaxedEdgeIndices.map((edgeIndex) => {
        const edge = state.edges[edgeIndex];
        return edge ? `(${edge.u} -> ${edge.v}, w=${edge.w})` : `(edge #${edgeIndex})`;
    });

    const changedNodesText = changedNodes.length
        ? changedNodes.map((node) => `N${node}`).join(', ')
        : 'none';

    const relaxedListHtml = relaxedItems.length
        ? `<ul>${relaxedItems.map((item) => `<li>${item}</li>`).join('')}</ul>`
        : '<p>No edge produced an improvement in this pass.</p>';

    elements.educationalExplanation.innerHTML =
        `<p><strong>${snapshot.label}:</strong> All edges were checked once.</p>` +
        `<p>Nodes with improved distance this pass: <strong>${changedNodesText}</strong>.</p>` +
        `<p>Relaxed edges:</p>${relaxedListHtml}`;
}

function updatePassSummary() {
    if (!state.lastRun) {
        elements.passSummary.textContent = 'Run the algorithm to inspect pass-by-pass updates.';
        renderEducationalExplanation();
        return;
    }

    if (!state.educationalMode) {
        elements.passSummary.textContent = state.isAnimating
            ? 'Animating passes... toggle Educational Mode to manually inspect each pass.'
            : 'Educational mode is off. Toggle it on to navigate each pass.';
        renderEducationalExplanation();
        return;
    }

    const snapshot = getActiveSnapshot();
    if (!snapshot) {
        elements.passSummary.textContent = 'No pass data available for this run.';
        renderEducationalExplanation();
        return;
    }

    if (snapshot.isFinal) {
        if (state.lastRun.negativeCycle) {
            elements.passSummary.textContent = 'Final result: negative cycle detected during the extra detection pass.';
        } else {
            elements.passSummary.textContent = `Final result after ${Math.max(1, state.vertexCount - 1)} passes and one extra detection pass.`;
        }
        renderEducationalExplanation();
        return;
    }

    const relaxCount = snapshot.relaxedEdgeIndices.length;
    elements.passSummary.textContent = `${snapshot.label}. Relaxations in this pass: ${relaxCount}.`;
    renderEducationalExplanation();
}

function animatePasses() {
    stopAnimation();

    if (!state.lastRun || !state.lastRun.passSnapshots.length) {
        return;
    }

    state.isAnimating = true;
    let passIndex = 0;
    state.selectedPass = passIndex;
    renderPassControls();
    updatePassSummary();
    drawGraph();

    state.animationTimer = setInterval(() => {
        passIndex += 1;

        if (passIndex >= state.lastRun.passSnapshots.length) {
            stopAnimation();
            state.selectedPass = -1;
            renderPassControls();
            updatePassSummary();
            drawGraph();
            return;
        }

        state.selectedPass = passIndex;
        renderPassControls();
        updatePassSummary();
        drawGraph();
    }, state.animationDelay);
}

function formatDistance(value) {
    if (!Number.isFinite(value)) {
        return 'INF';
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function renderResultTables(result, path) {
    const pathByNode = result.dist.map((distance, node) => {
        if (!Number.isFinite(distance)) {
            return '--';
        }
        const nodePath = reconstructPath(result.prev, state.source, node);
        return nodePath.length ? nodePath.join(' -> ') : '--';
    });

    const distanceRows = result.dist
        .map((distance, node) => `<tr><td>${node}</td><td>${formatDistance(distance)}</td><td>${pathByNode[node]}</td></tr>`)
        .join('');

    elements.distanceTable.innerHTML = `
        <table class="result-table">
            <thead>
                <tr><th>Node</th><th>Distance From Source</th><th>Path From Source</th></tr>
            </thead>
            <tbody>${distanceRows}</tbody>
        </table>
    `;

    if (!result.logs.length) {
        elements.logTable.innerHTML = '<p class="hint">No relaxations were needed after initialization.</p>';
        return;
    }

    const logRows = result.logs
        .map((entry) => `
            <tr>
                <td>${entry.pass}</td>
                <td>${entry.u} -> ${entry.v}</td>
                <td>${entry.w}</td>
                <td>${formatDistance(entry.oldDistance)}</td>
                <td>${formatDistance(entry.newDistance)}</td>
            </tr>
        `)
        .join('');

    elements.logTable.innerHTML = `
        <table class="result-table">
            <thead>
                <tr>
                    <th>Pass</th>
                    <th>Edge</th>
                    <th>Weight</th>
                    <th>Old Dist(v)</th>
                    <th>New Dist(v)</th>
                </tr>
            </thead>
            <tbody>${logRows}</tbody>
        </table>
    `;

    if (result.negativeCycle) {
        elements.summary.className = 'summary error';
        elements.summary.innerHTML = 'Negative cycle detected in the extra detection pass. Shortest paths are undefined.';
        return;
    }

    const targetDistance = result.dist[state.target];
    if (!Number.isFinite(targetDistance)) {
        elements.summary.className = 'summary success';
        elements.summary.innerHTML = `Source: <strong>${state.source}</strong>. Target: <strong>${state.target}</strong>. No path to target.`;
        return;
    }

    elements.summary.className = 'summary success';
    elements.summary.innerHTML = `Single-source run from <strong>${state.source}</strong>. Target: <strong>${state.target}</strong>. ` +
        `Shortest distance: <strong>${formatDistance(targetDistance)}</strong>. ` +
        `Path: <strong>${path.join(' -> ')}</strong>.`;
}

function getHighlightSets(result, path) {
    const predecessorEdges = new Set();
    const pathEdges = new Set();

    result.prev.forEach((u, v) => {
        if (u === null || u === undefined) {
            return;
        }
        const idx = state.edges.findIndex((edge) => edge.u === u && edge.v === v);
        if (idx >= 0) {
            predecessorEdges.add(idx);
        }
    });

    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const idx = state.edges.findIndex((edge) => edge.u === u && edge.v === v);
        if (idx >= 0) {
            pathEdges.add(idx);
        }
    }

    return { predecessorEdges, pathEdges };
}

function drawArrow(ctx, x1, y1, x2, y2, color, width) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const headLength = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 7), y2 - headLength * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 7), y2 - headLength * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
}

function drawGraph() {
    const canvas = elements.canvas;
    const ctx = canvas.getContext('2d');
    const cssWidth = canvas.clientWidth || 900;
    const cssHeight = 560;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    const radius = Math.max(120, Math.min(cssWidth, cssHeight) / 2 - 80);

    const nodePositions = Array.from({ length: state.vertexCount }, (_, node) => {
        const angle = (Math.PI * 2 * node) / state.vertexCount - Math.PI / 2;
        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    });

    let predecessorEdges = new Set();
    let pathEdges = new Set();
    let passRelaxedEdges = new Set();
    let offendingEdge = -1;
    let activeDistances = getInitialDistanceState();

    if (state.lastRun) {
        const activeSnapshot = getActiveSnapshot();
        const activeState = {
            prev: activeSnapshot ? activeSnapshot.prev : state.lastRun.prev
        };
        if (activeSnapshot && Array.isArray(activeSnapshot.dist)) {
            activeDistances = activeSnapshot.dist;
        } else {
            activeDistances = state.lastRun.dist;
        }
        const path = reconstructPath(activeState.prev, state.source, state.target);
        const sets = getHighlightSets(activeState, path);
        predecessorEdges = sets.predecessorEdges;
        pathEdges = sets.pathEdges;
        passRelaxedEdges = new Set(activeSnapshot ? activeSnapshot.relaxedEdgeIndices : []);
        offendingEdge = state.lastRun.offendingEdge;
    }

    state.edges.forEach((edge, index) => {
        const from = nodePositions[edge.u];
        const to = nodePositions[edge.v];

        if (!from || !to) {
            return;
        }

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy) || 1;
        const ux = dx / distance;
        const uy = dy / distance;

        const nodeRadius = 26;
        const startX = from.x + ux * nodeRadius;
        const startY = from.y + uy * nodeRadius;
        const endX = to.x - ux * (nodeRadius + 6);
        const endY = to.y - uy * (nodeRadius + 6);

        let color = '#7A7D67';
        let width = 2;

        if (passRelaxedEdges.has(index)) {
            color = '#58632C';
            width = 3;
        }

        if (predecessorEdges.has(index)) {
            color = '#94A570';
            width = 2.6;
        }

        if (pathEdges.has(index)) {
            color = '#DDAD28';
            width = 3.2;
        }

        if (state.lastRun && state.lastRun.negativeCycle && index === offendingEdge) {
            color = '#9A2A2A';
            width = 3.2;
        }

        drawArrow(ctx, startX, startY, endX, endY, color, width);

        const labelX = (startX + endX) / 2 + (-uy * 12);
        const labelY = (startY + endY) / 2 + (ux * 12);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = 'rgba(88, 99, 44, 0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(labelX - 16, labelY - 12, 32, 20, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2F3322';
        ctx.font = '12px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(edge.w), labelX, labelY - 1);
    });

    nodePositions.forEach((pos, node) => {
        let fill = '#E1CF96';
        let stroke = '#58632C';

        if (node === state.source) {
            fill = '#58632C';
            stroke = '#2F3322';
        } else if (node === state.target) {
            fill = '#DDAD28';
            stroke = '#58632C';
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 26, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = stroke;
        ctx.stroke();

        const distValue = activeDistances[node];
        const distText = Number.isFinite(distValue)
            ? (Number.isInteger(distValue) ? String(distValue) : distValue.toFixed(2))
            : 'INF';

        ctx.fillStyle = node === state.source ? '#F7F4F1' : '#2F3322';
        ctx.font = 'bold 12px Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`N${node}`, pos.x, pos.y - 8);
        ctx.font = '11px Roboto, sans-serif';
        ctx.fillText(distText, pos.x, pos.y + 9);
    });
}

function runAndRender() {
    stopAnimation();
    readStateFromControls();
    const result = runBellmanFord(state.vertexCount, state.edges, state.source);
    state.lastRun = result;
    state.selectedPass = -1;

    const path = result.negativeCycle ? [] : reconstructPath(result.prev, state.source, state.target);
    renderResultTables(result, path);
    renderPassControls();
    updatePassSummary();
    drawGraph();
    animatePasses();
}

function setSampleGraph() {
    stopAnimation();
    state.vertexCount = 5;
    state.source = 0;
    state.target = 4;
    state.edges = [
        { u: 1, v: 3, w: 2 },
        { u: 4, v: 3, w: -1 },
        { u: 2, v: 4, w: 1 },
        { u: 1, v: 2, w: 1 },
        { u: 0, v: 1, w: 5 }
    ];

    elements.vertexCount.value = String(state.vertexCount);
    renderSelectors();
    renderEdgeRows();
    state.lastRun = null;

    elements.summary.className = 'summary';
    elements.summary.innerHTML = 'Sample graph loaded. Press <strong>Run Bellman-Ford</strong>.';
    elements.distanceTable.innerHTML = '';
    elements.logTable.innerHTML = '';
    state.selectedPass = -1;
    renderPassControls();
    updatePassSummary();

    drawGraph();
}

function initialize() {
    renderSelectors();
    renderEdgeRows();
    drawGraph();

    elements.vertexCount.addEventListener('change', () => {
        stopAnimation();
        state.vertexCount = clamp(Number(elements.vertexCount.value) || 2, 2, 30);
        elements.vertexCount.value = String(state.vertexCount);

        state.source = clamp(state.source, 0, state.vertexCount - 1);
        state.target = clamp(state.target, 0, state.vertexCount - 1);

        renderSelectors();
        sanitizeEdgesForVertexCount();
        renderEdgeRows();
        state.lastRun = null;
        state.selectedPass = -1;
        renderPassControls();
        updatePassSummary();
        drawGraph();
    });

    elements.source.addEventListener('change', () => {
        stopAnimation();
        state.source = Number(elements.source.value);
        drawGraph();
    });

    elements.target.addEventListener('change', () => {
        stopAnimation();
        state.target = Number(elements.target.value);
        drawGraph();
    });

    elements.addEdgeBtn.addEventListener('click', () => {
        stopAnimation();
        state.edges.push({
            u: 0,
            v: Math.min(1, state.vertexCount - 1),
            w: 0
        });
        renderEdgeRows();
        drawGraph();
    });

    elements.clearEdgesBtn.addEventListener('click', () => {
        stopAnimation();
        state.edges = [];
        renderEdgeRows();
        state.lastRun = null;
        state.selectedPass = -1;
        elements.distanceTable.innerHTML = '';
        elements.logTable.innerHTML = '';
        elements.summary.className = 'summary';
        elements.summary.innerHTML = 'All edges cleared. Add edges and run the algorithm.';
        renderPassControls();
        updatePassSummary();
        drawGraph();
    });

    elements.educationalMode.addEventListener('change', () => {
        state.educationalMode = elements.educationalMode.checked;
        renderPassControls();
        updatePassSummary();
        drawGraph();
    });

    elements.passSelect.addEventListener('change', () => {
        stopAnimation();
        state.selectedPass = Number(elements.passSelect.value);
        updatePassSummary();
        drawGraph();
    });

    elements.passPrev.addEventListener('click', () => {
        if (!state.lastRun || !state.educationalMode) {
            return;
        }
        stopAnimation();
        const minValue = -1;
        state.selectedPass = Math.max(minValue, state.selectedPass - 1);
        renderPassControls();
        updatePassSummary();
        drawGraph();
    });

    elements.passNext.addEventListener('click', () => {
        if (!state.lastRun || !state.educationalMode) {
            return;
        }
        stopAnimation();
        const maxValue = state.lastRun.passSnapshots.length - 1;
        state.selectedPass = Math.min(maxValue, state.selectedPass + 1);
        renderPassControls();
        updatePassSummary();
        drawGraph();
    });

    elements.sampleBtn.addEventListener('click', setSampleGraph);
    elements.runBtn.addEventListener('click', runAndRender);

    window.addEventListener('resize', drawGraph);

    renderPassControls();
    updatePassSummary();
}

initialize();
