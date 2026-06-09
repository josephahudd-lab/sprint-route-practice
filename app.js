/* ==========================================================================
   SprintRoute: Application Logic
   ========================================================================== */

// --- Constants & Configuration ---
const IOF_COLORS = {
    purple: '#E6007E', // Standard orienteering magenta
    purpleGlow: 'rgba(230, 0, 126, 0.4)',
    startCyan: '#06b6d4',
    white: '#ffffff',
    black: '#000000'
};

const ROUTE_NEON_COLORS = [
    '#ff3366', // Neon Pink/Red
    '#33ff57', // Neon Green
    '#3380ff', // Neon Blue
    '#ff9933', // Neon Orange
    '#b833ff', // Neon Purple
    '#33ffff', // Neon Cyan
    '#ffff33'  // Neon Yellow
];

// Symbol Sizes in screen pixels (constant size for readability)
const SYMBOL_SIZES = {
    controlRadius: 15,       // 6mm visual equivalent
    startRadius: 13,         // 6mm side visual equivalent
    finishInnerRadius: 12,   // 5mm visual equivalent
    finishOuterRadius: 17,   // 7mm visual equivalent
    lineWidth: 2.5,          // standard line width
    controlLineWidth: 2.5,
    fontOffset: 20           // where to put control numbers
};

// --- Application State ---
let mapImage = null;
let originalFileBuffer = null; // Stored ArrayBuffer of the uploaded map
let originalFileType = '';    // 'image/png' or 'image/jpeg'
let originalFileName = 'map.png';

let viewTransform = {
    x: 0,         // Center x of viewport in map coordinate space
    y: 0,         // Center y of viewport in map coordinate space
    zoom: 1,      // Zoom factor
    rotation: 0   // Rotation angle in radians
};

// Scale Calibration
let scale = null; // meters per pixel. If null, map is uncalibrated.
let dpi = 300;
let mapScale = 4000;

// Course Definition
let courses = [
    {
        id: 'course-default',
        name: 'Course 1',
        start: null,
        controls: [],
        finish: null
    }
];
let activeCourseId = 'course-default';
let course = courses[0]; // Reference pointer to the active course object

// Runner details
let currentRunnerName = 'Runner 1';
let visibleRunners = {}; // Map of runnerName -> boolean

// Route Drawings
let routes = []; // Array of { id, legIndex, courseId, runnerName, name, points: [{x,y}], color, visible }
let activeLegIndex = -1; // -1 means Overview
let activeRouteId = null; // Selected route ID for drawing

// Interactive states
let appMode = 'PAN_ZOOM'; // 'PAN_ZOOM' | 'ADD_START' | 'ADD_CONTROL' | 'ADD_FINISH' | 'EDIT_COURSE' | 'DRAWING_ROUTE' | 'RULER_CALIBRATING'
let isDraggingMap = false;
let dragStartScreen = { x: 0, y: 0 };
let dragStartTransform = { x: 0, y: 0 };

let draggedControl = null; // { type: 'start'|'control'|'finish', index: number }

// Ruler Calibration drawing
let calibrationPoints = []; // Max 2 points: [{x,y}] in map coordinates

// Route drawing active state
let isDrawingRouteActive = false;

// Practice Mode State
let isPracticeMode = false;
let practiceRoutes = [];

// Waypoint drawing hover state
let drawingHoverPt = null;

// Pace settings
let runPaceMin = 3;
let runPaceSec = 30;

// Canvas details
let canvas, ctx;

// --- Initialize DOM & App ---
window.addEventListener('DOMContentLoaded', () => {
    initDOM();
    setupCanvas();
    setupEventListeners();
    loadFromLocalStorage();
    showToast('Welcome to SprintRoute! Load a map to begin.', 'info');
});

// --- DOM References ---
let elDropzone, elFileInput, elEmptyFileInput, elJsonFileInput;
let elEmptyState, elCanvas;
let elPanelCalibration, elPanelCourse, elPanelPractice, elPanelExport;
let elMapInfoCard, elMapName, elMapDimensions, elBtnChangeMap;
let elTabCalDpi, elTabCalRuler, elContentCalDpi, elContentCalRuler;
let elInputMapScale, elInputDpi, elBtnApplyDpiScale, elBtnStartRulerCal;
let elRulerCalHud, elRulerPixelLength, elInputRulerMeters, elBtnSaveRulerCal, elBtnCancelRulerCal;
let elCalibrationResultCard, elCalScaleText, elCalPixelsMeterText;
let elBtnToolStart, elBtnToolControl, elBtnToolFinish, elBtnToolSelectControl, elCourseListContainer, elCourseControlItems, elBtnClearCourse;
let elSelectActiveLeg, elLegPracticeArea, elBtnAddRoute, elRouteChoicesList;
let elInputRunPaceMin, elInputRunPaceSec;
let elBtnExportImageMeta, elBtnExportJson, elBtnImportJsonTrigger;
let elToolHud, elHudActiveTool, elHudScaleRatio, elViewControls;
let elBtnRotateCcw, elBtnRotateCw, elBtnZoomOut, elBtnZoomIn, elBtnResetView, elHudZoomPercent;
let elDrawingHud, elDrawingHudTitle, elDrawingHudRouteName, elStatRouteLength, elStatStraightLength, elStatEfficiency, elStatEstTime;
let elCalibrationBanner, elBtnExitCalibration;
// Modal dialog
let elModalCalibrationInput, elModalPixelSpan, elInputModalMeters, elBtnModalCalCancel, elBtnModalCalSave;

// Practice Mode elements
let elBtnStartPractice, elModalPracticeComplete, elPracticeSummaryContent, elBtnModalPracticeClose;

// Metadata found modal elements
let elModalMetadataFound, elMetadataCoursesSummary, elBtnModalMetadataClose;


// Multi-course & Runner Compare elements
let elSelectCourse, elBtnAddCourse, elBtnRenameCourse, elBtnDeleteCourse;
let elInputRunnerName, elRunnerComparisonList;

function initDOM() {
    elDropzone = document.getElementById('dropzone');
    elFileInput = document.getElementById('map-file-input');
    elEmptyFileInput = document.getElementById('empty-file-input');
    elJsonFileInput = document.getElementById('json-file-input');
    elEmptyState = document.getElementById('canvas-empty-state');
    elCanvas = document.getElementById('map-canvas');
    
    // Panels
    elPanelCalibration = document.getElementById('panel-calibration');
    elPanelCourse = document.getElementById('panel-course');
    elPanelPractice = document.getElementById('panel-practice');
    elPanelExport = document.getElementById('panel-export');
    
    // Map info
    elMapInfoCard = document.getElementById('map-info-card');
    elMapName = document.getElementById('map-name');
    elMapDimensions = document.getElementById('map-dimensions');
    elBtnChangeMap = document.getElementById('btn-change-map');
    
    // Tabs
    elTabCalDpi = document.getElementById('tab-cal-dpi');
    elTabCalRuler = document.getElementById('tab-cal-ruler');
    elContentCalDpi = document.getElementById('content-cal-dpi');
    elContentCalRuler = document.getElementById('content-cal-ruler');
    
    // Calibration actions
    elInputMapScale = document.getElementById('input-map-scale');
    elInputDpi = document.getElementById('input-dpi');
    elBtnApplyDpiScale = document.getElementById('btn-apply-dpi-scale');
    elBtnStartRulerCal = document.getElementById('btn-start-ruler-cal');
    elRulerCalHud = document.getElementById('calibration-ruler-hud');
    elRulerPixelLength = document.getElementById('ruler-pixel-length');
    elInputRulerMeters = document.getElementById('input-ruler-meters');
    elBtnSaveRulerCal = document.getElementById('btn-save-ruler-cal');
    elBtnCancelRulerCal = document.getElementById('btn-cancel-ruler-cal');
    elCalibrationResultCard = document.getElementById('calibration-result-card');
    elCalScaleText = document.getElementById('cal-scale-text');
    elCalPixelsMeterText = document.getElementById('cal-pixels-meter-text');
    
    // Course buttons
    elBtnToolStart = document.getElementById('btn-tool-start');
    elBtnToolControl = document.getElementById('btn-tool-control');
    elBtnToolFinish = document.getElementById('btn-tool-finish');
    elBtnToolSelectControl = document.getElementById('btn-tool-select-control');
    elCourseListContainer = document.getElementById('course-list-container');
    elCourseControlItems = document.getElementById('course-control-items');
    elBtnClearCourse = document.getElementById('btn-clear-course');
    
    // Practice & leg selection
    elSelectActiveLeg = document.getElementById('select-active-leg');
    elLegPracticeArea = document.getElementById('leg-practice-area');
    elBtnAddRoute = document.getElementById('btn-add-route');
    elRouteChoicesList = document.getElementById('route-choices-list');
    elInputRunPaceMin = document.getElementById('input-run-pace-min');
    elInputRunPaceSec = document.getElementById('input-run-pace-sec');
    
    // Exports
    elBtnExportImageMeta = document.getElementById('btn-export-image-meta');
    elBtnExportJson = document.getElementById('btn-export-json');
    elBtnImportJsonTrigger = document.getElementById('btn-import-json-trigger');
    
    // Floating HUDs
    elToolHud = document.getElementById('tool-hud');
    elHudActiveTool = document.getElementById('hud-active-tool');
    elHudScaleRatio = document.getElementById('hud-scale-ratio');
    elViewControls = document.getElementById('view-controls');
    elBtnRotateCcw = document.getElementById('btn-rotate-ccw');
    elBtnRotateCw = document.getElementById('btn-rotate-cw');
    elBtnZoomOut = document.getElementById('btn-zoom-out');
    elBtnZoomIn = document.getElementById('btn-zoom-in');
    elBtnResetView = document.getElementById('btn-reset-view');
    elHudZoomPercent = document.getElementById('hud-zoom-percent');
    
    // Drawing HUD
    elDrawingHud = document.getElementById('drawing-hud');
    elDrawingHudTitle = document.getElementById('drawing-hud-title');
    elDrawingHudRouteName = document.getElementById('drawing-hud-route-name');
    elStatRouteLength = document.getElementById('stat-route-length');
    elStatStraightLength = document.getElementById('stat-straight-length');
    elStatEfficiency = document.getElementById('stat-efficiency');
    elStatEstTime = document.getElementById('stat-est-time');
    
    // Banner overlay
    elCalibrationBanner = document.getElementById('calibration-banner');
    elBtnExitCalibration = document.getElementById('btn-exit-calibration');
    
    // Modal dialog
    elModalCalibrationInput = document.getElementById('modal-calibration-input');
    elModalPixelSpan = document.getElementById('modal-pixel-span');
    elInputModalMeters = document.getElementById('input-modal-meters');
    elBtnModalCalCancel = document.getElementById('btn-modal-cal-cancel');
    elBtnModalCalSave = document.getElementById('btn-modal-cal-save');
    
    // Practice Mode elements
    elBtnStartPractice = document.getElementById('btn-start-practice');
    elModalPracticeComplete = document.getElementById('modal-practice-complete');
    elPracticeSummaryContent = document.getElementById('practice-summary-content');
    elBtnModalPracticeClose = document.getElementById('btn-modal-practice-close');

    // Metadata found modal elements
    elModalMetadataFound = document.getElementById('modal-metadata-found');
    elMetadataCoursesSummary = document.getElementById('metadata-courses-summary');
    elBtnModalMetadataClose = document.getElementById('btn-modal-metadata-close');


    // Course switcher references
    elSelectCourse = document.getElementById('select-course');
    elBtnAddCourse = document.getElementById('btn-add-course');
    elBtnRenameCourse = document.getElementById('btn-rename-course');
    elBtnDeleteCourse = document.getElementById('btn-delete-course');
    
    // Runner references
    elInputRunnerName = document.getElementById('input-runner-name');
    elRunnerComparisonList = document.getElementById('runner-comparison-list');
}

function setupCanvas() {
    canvas = elCanvas;
    ctx = canvas.getContext('2d');
    resizeCanvasToContainer();
    window.addEventListener('resize', () => {
        resizeCanvasToContainer();
        requestRepaint();
    });
}

function resizeCanvasToContainer() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}

// --- Event Listeners ---
function setupEventListeners() {
    // Dropzone & File loading
    const handleDragOver = (e) => {
        e.preventDefault();
        elDropzone.classList.add('dragover');
    };
    const handleDragLeave = () => {
        elDropzone.classList.remove('dragover');
    };
    const handleDrop = (e) => {
        e.preventDefault();
        elDropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    };
    
    elDropzone.addEventListener('dragover', handleDragOver);
    elDropzone.addEventListener('dragleave', handleDragLeave);
    elDropzone.addEventListener('drop', handleDrop);
    
    elFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleImageUpload(e.target.files[0]);
    });
    elEmptyFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleImageUpload(e.target.files[0]);
    });
    
    elBtnChangeMap.addEventListener('click', () => {
        if (confirm("Are you sure you want to load a different map? This will reset the current session.")) {
            resetSession();
        }
    });

    // Calibration Tabs
    elTabCalDpi.addEventListener('click', () => {
        elTabCalDpi.classList.add('active');
        elTabCalRuler.classList.remove('active');
        elContentCalDpi.classList.add('active');
        elContentCalRuler.classList.remove('active');
        setAppMode('PAN_ZOOM');
    });
    elTabCalRuler.addEventListener('click', () => {
        elTabCalRuler.classList.add('active');
        elTabCalDpi.classList.remove('active');
        elContentCalRuler.classList.add('active');
        elContentCalDpi.classList.remove('active');
    });

    // DPI/Scale Calibration
    elBtnApplyDpiScale.addEventListener('click', applyDpiScale);
    elBtnStartRulerCal.addEventListener('click', startRulerCalibration);
    elBtnCancelRulerCal.addEventListener('click', cancelRulerCalibration);
    elBtnSaveRulerCal.addEventListener('click', saveRulerCalibration);
    
    // Ruler Modal Calibration
    elBtnModalCalCancel.addEventListener('click', () => {
        elModalCalibrationInput.style.display = 'none';
        cancelRulerCalibration();
    });
    elBtnModalCalSave.addEventListener('click', applyModalCalibration);

    // Course Tools
    elBtnToolStart.addEventListener('click', () => toggleTool('ADD_START', elBtnToolStart));
    elBtnToolControl.addEventListener('click', () => toggleTool('ADD_CONTROL', elBtnToolControl));
    elBtnToolFinish.addEventListener('click', () => toggleTool('ADD_FINISH', elBtnToolFinish));
    elBtnToolSelectControl.addEventListener('click', () => toggleTool('EDIT_COURSE', elBtnToolSelectControl));
    elBtnClearCourse.addEventListener('click', clearCourse);

    // Zoom / Rotate Controls
    elBtnRotateCcw.addEventListener('click', () => rotateMap(-15));
    elBtnRotateCw.addEventListener('click', () => rotateMap(15));
    elBtnZoomOut.addEventListener('click', () => zoomMap(0.8));
    elBtnZoomIn.addEventListener('click', () => zoomMap(1.2));
    elBtnResetView.addEventListener('click', resetView);

    // Legs / Practice
    elSelectActiveLeg.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        setActiveLeg(val);
    });
    elBtnAddRoute.addEventListener('click', addNewRouteChoice);
    elBtnExitCalibration.addEventListener('click', () => setAppMode('PAN_ZOOM'));

    // Pace setting
    elInputRunPaceMin.addEventListener('input', (e) => {
        runPaceMin = Math.max(0, parseInt(e.target.value) || 0);
        updateRouteListAndHud();
    });
    elInputRunPaceSec.addEventListener('input', (e) => {
        runPaceSec = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
        updateRouteListAndHud();
    });

    // Exports
    elBtnExportImageMeta.addEventListener('click', exportPngWithMetadata);
    elBtnExportJson.addEventListener('click', exportJsonFile);
    elBtnImportJsonTrigger.addEventListener('click', () => elJsonFileInput.click());
    elJsonFileInput.addEventListener('change', importJsonFile);

    // Canvas Events (Pan, Zoom, Draw)
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('wheel', handleCanvasWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // prevent context menu on canvas

    // Keyboard Shortcuts
    window.addEventListener('keydown', handleKeyDown);

    // Practice Mode event listeners
    elBtnStartPractice.addEventListener('click', togglePracticeMode);
    elBtnModalPracticeClose.addEventListener('click', () => {
        elModalPracticeComplete.style.display = 'none';
    });
    elBtnModalMetadataClose.addEventListener('click', () => {
        elModalMetadataFound.style.display = 'none';
    });


    // Course switcher event listeners
    elSelectCourse.addEventListener('change', (e) => selectCourse(e.target.value));
    elBtnAddCourse.addEventListener('click', createNewCourse);
    elBtnRenameCourse.addEventListener('click', renameCourse);
    elBtnDeleteCourse.addEventListener('click', deleteCourse);
    
    // Runner event listeners
    elInputRunnerName.addEventListener('input', (e) => {
        currentRunnerName = e.target.value.trim() || 'Runner 1';
        updateRouteListAndHud();
        updateRunnerComparisonList();
        saveToLocalStorage();
    });
}

// --- Map Image Upload and Reading ---
function handleImageUpload(file) {
    if (!file) return;
    originalFileName = file.name;
    originalFileType = file.type;

    // Load file as ArrayBuffer first to preserve original binary data
    const reader = new FileReader();
    reader.onload = function(e) {
        originalFileBuffer = e.target.result;
        
        // Scan for embedded metadata inside this file!
        const scannedProject = scanForEmbeddedMetadata(originalFileBuffer);
        
        // Now create a blob to load into mapImage object for canvas rendering
        const blob = new Blob([originalFileBuffer], { type: originalFileType });
        const imageUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.onload = function() {
            mapImage = img;
            
            // Adjust Empty State / Canvas visibility
            elEmptyState.style.display = 'none';
            elCanvas.style.display = 'block';
            
            // Update Card Info
            elMapInfoCard.style.display = 'flex';
            elMapName.textContent = originalFileName;
            elMapDimensions.textContent = `${img.width} x ${img.height} px`;
            
            // Enable next panels
            elPanelCalibration.classList.remove('disabled');
            elPanelCourse.classList.remove('disabled');
            elPanelExport.classList.remove('disabled');
            
            // Set initial viewport transforms
            resetView();
            
            // Load scanned project data or start fresh
            if (scannedProject) {
                loadProjectData(scannedProject);
                showMetadataFoundModal(scannedProject);
            } else {

                setAppMode('PAN_ZOOM');
                courses = [{ id: 'course-default', name: 'Course 1', start: null, controls: [], finish: null }];
                activeCourseId = 'course-default';
                course = courses[0];
                routes = [];
                visibleRunners = {};
                updateCourseSelectDropdown();
                updateCourseList();
                updateLegSelectionOptions();
                updateRunnerComparisonList();
                showToast('Map image loaded successfully. Calibrate scale next.', 'info');
            }
            
            saveToLocalStorage();
        };
        img.src = imageUrl;
    };
    reader.readAsArrayBuffer(file);
}

// --- Metadata Steganography Parser ---
function scanForEmbeddedMetadata(arrayBuffer) {
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert only the last 2MB to string to check for metadata, protecting memory limit
    const scanLimit = 1024 * 1024 * 2; // 2MB
    const sliceStart = Math.max(0, uint8Array.length - scanLimit);
    const tailBytes = uint8Array.subarray(sliceStart);
    
    const decoder = new TextDecoder('utf-8');
    const textTail = decoder.decode(tailBytes);
    
    const startMarker = "---SPRINTROUTE-METADATA-START---";
    const endMarker = "---SPRINTROUTE-METADATA-END---";
    
    const startIdx = textTail.indexOf(startMarker);
    const endIdx = textTail.indexOf(endMarker);
    
    if (startIdx !== -1 && endIdx !== -1) {
        try {
            const jsonStart = startIdx + startMarker.length;
            const jsonStr = textTail.substring(jsonStart, endIdx).trim();
            return JSON.parse(jsonStr);
        } catch (err) {
            console.error("Error parsing embedded JSON metadata", err);
            showToast("Failed to parse embedded project metadata.", "warning");
        }
    }
    return null;
}

// --- Apply DPI & Scale Calibration ---
function applyDpiScale() {
    dpi = parseInt(elInputDpi.value) || 300;
    mapScale = parseInt(elInputMapScale.value) || 4000;
    
    // 1 px = (0.0254 * mapScale) / dpi meters
    scale = (0.0254 * mapScale) / dpi;
    updateCalibrationUI();
    showToast(`Scale calibrated: 1 pixel = ${scale.toFixed(4)}m`, 'success');
    saveToLocalStorage();
}

function updateCalibrationUI() {
    if (scale === null) {
        elCalibrationResultCard.style.display = 'none';
        elHudScaleRatio.textContent = "Uncalibrated";
        elPanelPractice.classList.add('disabled');
        return;
    }
    
    elCalibrationResultCard.style.display = 'flex';
    elCalScaleText.textContent = `1 px = ${scale.toFixed(4)}m`;
    const pixelsPerMeter = 1 / scale;
    elCalPixelsMeterText.textContent = `${pixelsPerMeter.toFixed(2)} px/meter`;
    
    elHudScaleRatio.textContent = `1 px = ${scale.toFixed(2)}m`;
    
    // Enable Route choice drawing panel
    elPanelPractice.classList.remove('disabled');
    
    requestRepaint();
}

// --- Manual Calibration Ruler ---
function startRulerCalibration() {
    calibrationPoints = [];
    setAppMode('RULER_CALIBRATING');
    showToast("Click point 1, then point 2 on the map to define distance", "info");
}

function cancelRulerCalibration() {
    calibrationPoints = [];
    setAppMode('PAN_ZOOM');
}

function saveRulerCalibration() {
    if (calibrationPoints.length < 2) return;
    
    const dx = calibrationPoints[1].x - calibrationPoints[0].x;
    const dy = calibrationPoints[1].y - calibrationPoints[0].y;
    const pxLen = Math.sqrt(dx * dx + dy * dy);
    
    const meters = parseFloat(elInputRulerMeters.value) || 100;
    
    scale = meters / pxLen;
    updateCalibrationUI();
    elRulerCalHud.style.display = 'none';
    setAppMode('PAN_ZOOM');
    showToast(`Manual scale calibrated: 1 pixel = ${scale.toFixed(4)}m`, 'success');
    saveToLocalStorage();
}

// --- IOF Course Editor Operations ---
function toggleTool(mode, buttonEl) {
    if (appMode === mode) {
        setAppMode('PAN_ZOOM');
    } else {
        setAppMode(mode);
        // Deactivate other buttons
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        if (buttonEl) buttonEl.classList.add('active');
    }
}

function addCourseElement(mapPoint) {
    if (appMode === 'ADD_START') {
        course.start = mapPoint;
        setAppMode('EDIT_COURSE'); // Switch to Edit
        showToast('Start triangle placed. Connect controls next.', 'info');
    } else if (appMode === 'ADD_CONTROL') {
        const nextLabel = (course.controls.length + 1).toString();
        course.controls.push({
            x: mapPoint.x,
            y: mapPoint.y,
            label: nextLabel
        });
        showToast(`Control ${nextLabel} placed.`, 'info');
    } else if (appMode === 'ADD_FINISH') {
        course.finish = mapPoint;
        setAppMode('EDIT_COURSE');
        showToast('Finish placed. Course setup complete.', 'info');
    }
    
    updateCourseList();
    updateLegSelectionOptions();
    saveToLocalStorage();
    requestRepaint();
}

function updateCourseList() {
    if (!course.start && course.controls.length === 0 && !course.finish) {
        elCourseListContainer.style.display = 'none';
        return;
    }
    
    elCourseListContainer.style.display = 'block';
    elCourseControlItems.innerHTML = '';
    
    if (course.start) {
        addControlRow('Start', 'start-badge', course.start.x, course.start.y, () => {
            course.start = null;
            updateCourseList();
            updateLegSelectionOptions();
            requestRepaint();
        });
    }
    
    course.controls.forEach((ctrl, idx) => {
        addControlRow(`Control ${ctrl.label}`, 'normal-badge', ctrl.x, ctrl.y, () => {
            course.controls.splice(idx, 1);
            // Re-label controls sequentially
            course.controls.forEach((c, i) => c.label = (i + 1).toString());
            updateCourseList();
            updateLegSelectionOptions();
            requestRepaint();
        });
    });
    
    if (course.finish) {
        addControlRow('Finish', 'finish-badge', course.finish.x, course.finish.y, () => {
            course.finish = null;
            updateCourseList();
            updateLegSelectionOptions();
            requestRepaint();
        });
    }
}

function addControlRow(name, badgeClass, x, y, onDelete) {
    const item = document.createElement('div');
    item.className = 'control-list-item';
    
    const left = document.createElement('div');
    left.className = 'control-item-left';
    
    const badge = document.createElement('span');
    badge.className = `control-badge ${badgeClass}`;
    badge.textContent = badgeClass === 'normal-badge' ? name.split(' ')[1] : (badgeClass === 'start-badge' ? '▲' : '◎');
    
    const label = document.createElement('span');
    label.className = 'control-item-name';
    label.textContent = name;
    
    const coords = document.createElement('span');
    coords.className = 'control-item-coords';
    coords.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
    
    left.appendChild(badge);
    left.appendChild(label);
    left.appendChild(coords);
    
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon-danger';
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    delBtn.addEventListener('click', onDelete);
    
    item.appendChild(left);
    item.appendChild(delBtn);
    elCourseControlItems.appendChild(item);
}

function clearCourse() {
    if (confirm("Delete the entire course layout?")) {
        course.start = null;
        course.controls = [];
        course.finish = null;
        routes = [];
        activeLegIndex = -1;
        updateCourseList();
        updateLegSelectionOptions();
        saveToLocalStorage();
        requestRepaint();
    }
}

// --- Leg Management & Selecting ---
function getLegs() {
    const legs = [];
    if (!course.start) return legs;
    
    let prevPoint = course.start;
    let prevName = 'Start';
    
    course.controls.forEach((ctrl, idx) => {
        legs.push({
            index: idx,
            name: `${prevName} → Control ${ctrl.label}`,
            startPt: prevPoint,
            endPt: ctrl
        });
        prevPoint = ctrl;
        prevName = `Control ${ctrl.label}`;
    });
    
    if (course.finish) {
        legs.push({
            index: course.controls.length,
            name: `${prevName} → Finish`,
            startPt: prevPoint,
            endPt: course.finish
        });
    }
    
    return legs;
}

function updateLegSelectionOptions() {
    const legs = getLegs();
    const currentSelected = elSelectActiveLeg.value;
    
    elSelectActiveLeg.innerHTML = '<option value="-1">-- Overview (No Drawing) --</option>';
    
    legs.forEach(leg => {
        const option = document.createElement('option');
        option.value = leg.index;
        option.textContent = leg.name;
        elSelectActiveLeg.appendChild(option);
    });
    
    if (parseInt(currentSelected) < legs.length) {
        elSelectActiveLeg.value = currentSelected;
    } else {
        elSelectActiveLeg.value = "-1";
        setActiveLeg(-1);
    }
}

function setActiveLeg(idx) {
    activeLegIndex = idx;
    elSelectActiveLeg.value = idx.toString();
    
    if (activeLegIndex === -1) {
        elLegPracticeArea.style.display = 'none';
        setAppMode('PAN_ZOOM');
    } else {
        elLegPracticeArea.style.display = 'block';
        setAppMode('PAN_ZOOM');
        updateRouteListAndHud();
        
        // Auto-center view on this leg
        focusViewOnLeg(activeLegIndex);
    }
    
    requestRepaint();
}

function focusViewOnLeg(legIdx) {
    const legs = getLegs();
    const leg = legs.find(l => l.index === legIdx);
    if (!leg) return;
    
    const midX = (leg.startPt.x + leg.endPt.x) / 2;
    const midY = (leg.startPt.y + leg.endPt.y) / 2;
    
    // Smooth scroll center to the midpoint
    viewTransform.x = midX;
    viewTransform.y = midY;
    
    // Zoom to fit the leg comfortably
    const dx = leg.endPt.x - leg.startPt.x;
    const dy = leg.endPt.y - leg.startPt.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    const viewSize = Math.min(canvas.width, canvas.height);
    const targetZoom = Math.max(0.1, Math.min(4, (viewSize * 0.6) / dist));
    viewTransform.zoom = targetZoom;
    
    // Auto-rotate the leg so target control is at the top of the page, and start control is at bottom
    if (legIdx !== -1) {
        viewTransform.rotation = -Math.PI / 2 - Math.atan2(dy, dx);
    } else {
        viewTransform.rotation = 0;
    }
    
    updateZoomHUD();
    requestRepaint();
}

// --- Route Choice Operations ---
function addNewRouteChoice() {
    if (activeLegIndex === -1) return;
    
    const activeLegRoutes = routes.filter(r => r.legIndex === activeLegIndex);
    const letter = String.fromCharCode(65 + (activeLegRoutes.length % 26));
    
    const legs = getLegs();
    const leg = legs.find(l => l.index === activeLegIndex);
    const startPt = leg ? { x: leg.startPt.x, y: leg.startPt.y } : null;
    
    const newRoute = {
        id: 'route-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        courseId: activeCourseId,
        runnerName: currentRunnerName,
        legIndex: activeLegIndex,
        name: `Route ${letter}`,
        points: startPt ? [startPt] : [],
        color: ROUTE_NEON_COLORS[activeLegRoutes.length % ROUTE_NEON_COLORS.length],
        visible: true
    };
    
    routes.push(newRoute);
    activeRouteId = newRoute.id;
    
    setAppMode('DRAWING_ROUTE');
    showToast(`Draw mode active for ${newRoute.name}. Click points to trace your route. Click near the target control to finish.`, 'info');
    
    updateRouteListAndHud();
    saveToLocalStorage();
    requestRepaint();
}

function getActiveRoute() {
    return routes.find(r => r.id === activeRouteId);
}

function updateRouteListAndHud() {
    if (activeLegIndex === -1) {
        elDrawingHud.style.display = 'none';
        return;
    }
    
    const legs = getLegs();
    const leg = legs.find(l => l.index === activeLegIndex);
    if (!leg) return;
    
    elDrawingHudTitle.textContent = leg.name;
    
    const activeLegRoutes = routes.filter(r => r.legIndex === activeLegIndex);
    elRouteChoicesList.innerHTML = '';
    
    if (activeLegRoutes.length === 0) {
        elRouteChoicesList.innerHTML = '<p class="section-desc" style="text-align: center; margin: 10px 0;">No routes drawn yet. Click "+ New Route" to practice this leg.</p>';
    }
    
    // Find straight line distance
    const dx = leg.endPt.x - leg.startPt.x;
    const dy = leg.endPt.y - leg.startPt.y;
    const straightPix = Math.sqrt(dx*dx + dy*dy);
    const straightMeters = scale !== null ? straightPix * scale : 0;
    
    activeLegRoutes.forEach(route => {
        const routeLenMeters = calculateRouteLength(route);
        const efficiency = straightMeters > 0 ? (straightMeters / routeLenMeters) * 100 : 100;
        const estTimeStr = calculateEstTime(routeLenMeters);
        
        const card = document.createElement('div');
        card.className = `route-item ${activeRouteId === route.id ? 'active' : ''}`;
        if (activeRouteId === route.id) {
            card.style.setProperty('--active-border-color', route.color);
        }
        
        const header = document.createElement('div');
        header.className = 'route-item-header';
        
        const title = document.createElement('div');
        title.className = 'route-item-title';
        title.innerHTML = `
            <span class="route-color-dot" style="background-color: ${route.color};"></span>
            <span>${route.runnerName}: ${route.name}</span>
        `;
        
        const actions = document.createElement('div');
        actions.className = 'route-item-actions';
        
        // Hide/Show Toggle
        const btnVis = document.createElement('button');
        btnVis.className = 'btn-icon-sm';
        btnVis.title = route.visible ? 'Hide route' : 'Show route';
        btnVis.innerHTML = route.visible 
            ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
            : `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        btnVis.addEventListener('click', (e) => {
            e.stopPropagation();
            route.visible = !route.visible;
            updateRouteListAndHud();
            requestRepaint();
        });
        
        // Draw/Draw Mode Toggle
        const btnDraw = document.createElement('button');
        btnDraw.className = 'btn-icon-sm';
        btnDraw.title = 'Redraw route';
        btnDraw.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
        btnDraw.addEventListener('click', (e) => {
            e.stopPropagation();
            activeRouteId = route.id;
            setAppMode('DRAWING_ROUTE');
            updateRouteListAndHud();
            requestRepaint();
        });
        
        // Delete Route
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-icon-sm delete-btn';
        btnDel.title = 'Delete route';
        btnDel.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Delete ${route.name}?`)) {
                routes = routes.filter(r => r.id !== route.id);
                if (activeRouteId === route.id) activeRouteId = null;
                updateRouteListAndHud();
                saveToLocalStorage();
                requestRepaint();
            }
        });
        
        actions.appendChild(btnVis);
        actions.appendChild(btnDraw);
        actions.appendChild(btnDel);
        
        header.appendChild(title);
        header.appendChild(actions);
        
        const body = document.createElement('div');
        body.className = 'route-item-body';
        body.innerHTML = `
            <div class="route-stat">
                <span class="route-stat-lbl">Len</span>
                <span class="route-stat-val">${scale !== null ? Math.round(routeLenMeters) + 'm' : '-'}</span>
            </div>
            <div class="route-stat">
                <span class="route-stat-lbl">Ratio</span>
                <span class="route-stat-val">${scale !== null ? (routeLenMeters / Math.max(1, straightMeters)).toFixed(2) : '-'}</span>
            </div>
            <div class="route-stat">
                <span class="route-stat-lbl">Time</span>
                <span class="route-stat-val highlight-green">${scale !== null ? estTimeStr : '-'}</span>
            </div>
        `;
        
        card.appendChild(header);
        card.appendChild(body);
        card.addEventListener('click', () => {
            activeRouteId = route.id;
            updateRouteListAndHud();
            requestRepaint();
        });
        
        elRouteChoicesList.appendChild(card);
    });
    
    // Update active route HUD info
    const activeRoute = getActiveRoute();
    if (activeRoute && appMode === 'DRAWING_ROUTE') {
        elDrawingHud.style.display = 'flex';
        elDrawingHudRouteName.textContent = activeRoute.name;
        elDrawingHudRouteName.style.color = activeRoute.color;
        
        const routeLenMeters = calculateRouteLength(activeRoute);
        const efficiency = straightMeters > 0 ? (straightMeters / routeLenMeters) * 100 : 100;
        
        elStatRouteLength.textContent = scale !== null ? Math.round(routeLenMeters) + 'm' : 'Uncalibrated';
        elStatStraightLength.textContent = scale !== null ? Math.round(straightMeters) + 'm' : 'Uncalibrated';
        elStatEfficiency.textContent = scale !== null ? Math.round(efficiency) + '%' : '-';
        elStatEstTime.textContent = scale !== null ? calculateEstTime(routeLenMeters) : '-';
    } else {
        elDrawingHud.style.display = 'none';
    }
}

function calculateRouteLength(route) {
    if (!route || route.points.length < 2) return 0;
    let totalPix = 0;
    for (let i = 0; i < route.points.length - 1; i++) {
        const dx = route.points[i+1].x - route.points[i].x;
        const dy = route.points[i+1].y - route.points[i].y;
        totalPix += Math.sqrt(dx*dx + dy*dy);
    }
    return scale !== null ? totalPix * scale : totalPix;
}

function calculateEstTime(distanceMeters) {
    if (distanceMeters <= 0) return '0:00';
    const totalPaceSec = (runPaceMin * 60) + runPaceSec;
    const estSec = (distanceMeters / 1000) * totalPaceSec;
    const mins = Math.floor(estSec / 60);
    const secs = Math.round(estSec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// --- View Transform Matrix Helpers ---
function rotateMap(deg) {
    viewTransform.rotation += (deg * Math.PI) / 180;
    requestRepaint();
}

function zoomMap(factor) {
    viewTransform.zoom = Math.max(0.05, Math.min(20, viewTransform.zoom * factor));
    updateZoomHUD();
    requestRepaint();
}

function resetView() {
    if (!mapImage) return;
    viewTransform.x = mapImage.width / 2;
    viewTransform.y = mapImage.height / 2;
    
    const zoomX = canvas.width / mapImage.width;
    const zoomY = canvas.height / mapImage.height;
    viewTransform.zoom = Math.max(0.05, Math.min(2, Math.min(zoomX, zoomY) * 0.95));
    viewTransform.rotation = 0;
    
    updateZoomHUD();
    requestRepaint();
}

function updateZoomHUD() {
    elHudZoomPercent.textContent = `${Math.round(viewTransform.zoom * 100)}%`;
}

// --- Coordinate Projection Formulas ---
function screenToMap(sx, sy) {
    const dx = sx - canvas.width / 2;
    const dy = sy - canvas.height / 2;
    // Rotate back by -rotation
    const theta = -viewTransform.rotation;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rx = (dx * cos - dy * sin) / viewTransform.zoom;
    const ry = (dx * sin + dy * cos) / viewTransform.zoom;
    return {
        x: rx + viewTransform.x,
        y: ry + viewTransform.y
    };
}

function mapToScreen(mx, my) {
    const dx = mx - viewTransform.x;
    const dy = my - viewTransform.y;
    // Scale and rotate by viewTransform.rotation
    const scaledX = dx * viewTransform.zoom;
    const scaledY = dy * viewTransform.zoom;
    const theta = viewTransform.rotation;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rx = scaledX * cos - scaledY * sin;
    const ry = scaledX * sin + scaledY * cos;
    return {
        x: rx + canvas.width / 2,
        y: ry + canvas.height / 2
    };
}

// --- Mouse / Touch Handlers ---
function handleCanvasMouseDown(e) {
    if (!mapImage) return;
    const isRightBtn = e.button === 2;
    const isMiddleBtn = e.button === 1;
    const isSpacePressed = window.isSpacebarPressed || false;
    
    const screenX = e.offsetX;
    const screenY = e.offsetY;
    const mapPt = screenToMap(screenX, screenY);
    
    // Panning Activation Conditions: Spacebar, Middle Button, Right Button, or default Pan/Zoom mode
    if (isSpacePressed || isMiddleBtn || isRightBtn || appMode === 'PAN_ZOOM') {
        isDraggingMap = true;
        dragStartScreen = { x: screenX, y: screenY };
        dragStartTransform = { x: viewTransform.x, y: viewTransform.y };
        canvas.parentElement.classList.add('mousedown');
        return;
    }
    
    // Scale calibration mode click
    if (appMode === 'RULER_CALIBRATING') {
        calibrationPoints.push(mapPt);
        if (calibrationPoints.length === 1) {
            showToast("Click point 2 to complete calibration line.", "info");
        } else if (calibrationPoints.length === 2) {
            // Compute pixel length
            const dx = calibrationPoints[1].x - calibrationPoints[0].x;
            const dy = calibrationPoints[1].y - calibrationPoints[0].y;
            const pxLen = Math.round(Math.sqrt(dx*dx + dy*dy));
            
            // Show Modal
            elModalPixelSpan.textContent = pxLen;
            elModalCalibrationInput.style.display = 'flex';
            elInputModalMeters.focus();
        }
        requestRepaint();
        return;
    }
    
    // Course Editing placement clicks
    if (['ADD_START', 'ADD_CONTROL', 'ADD_FINISH'].includes(appMode)) {
        addCourseElement(mapPt);
        return;
    }
    
    // Course select / Drag and drop controls
    if (appMode === 'EDIT_COURSE') {
        // Find if we clicked close to start, control, or finish
        const clickToleranceScreen = 15; // pixels on screen
        
        if (course.start) {
            const startScreen = mapToScreen(course.start.x, course.start.y);
            const dist = Math.sqrt((screenX - startScreen.x)**2 + (screenY - startScreen.y)**2);
            if (dist <= clickToleranceScreen) {
                draggedControl = { type: 'start' };
                return;
            }
        }
        
        for (let i = 0; i < course.controls.length; i++) {
            const ctrlScreen = mapToScreen(course.controls[i].x, course.controls[i].y);
            const dist = Math.sqrt((screenX - ctrlScreen.x)**2 + (screenY - ctrlScreen.y)**2);
            if (dist <= clickToleranceScreen) {
                draggedControl = { type: 'control', index: i };
                return;
            }
        }
        
        if (course.finish) {
            const finishScreen = mapToScreen(course.finish.x, course.finish.y);
            const dist = Math.sqrt((screenX - finishScreen.x)**2 + (screenY - finishScreen.y)**2);
            if (dist <= clickToleranceScreen) {
                draggedControl = { type: 'finish' };
                return;
            }
        }
        return;
    }
    
    // Drawing route choice mode
    if (appMode === 'DRAWING_ROUTE') {
        dragStartScreen = { x: screenX, y: screenY };
        return;
    }
}

function handleCanvasMouseMove(e) {
    if (!mapImage) return;
    const screenX = e.offsetX;
    const screenY = e.offsetY;
    const mapPt = screenToMap(screenX, screenY);
    
    // Dragging Map
    if (isDraggingMap) {
        const dx = screenX - dragStartScreen.x;
        const dy = screenY - dragStartScreen.y;
        // Rotate the drag offsets back by map rotation
        const theta = -viewTransform.rotation;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const rx = (dx * cos - dy * sin) / viewTransform.zoom;
        const ry = (dx * sin + dy * cos) / viewTransform.zoom;
        
        viewTransform.x = dragStartTransform.x - rx;
        viewTransform.y = dragStartTransform.y - ry;
        requestRepaint();
        return;
    }
    
    // Dragging controls
    if (appMode === 'EDIT_COURSE' && draggedControl) {
        if (draggedControl.type === 'start') {
            course.start = mapPt;
        } else if (draggedControl.type === 'control') {
            course.controls[draggedControl.index].x = mapPt.x;
            course.controls[draggedControl.index].y = mapPt.y;
        } else if (draggedControl.type === 'finish') {
            course.finish = mapPt;
        }
        updateCourseList();
        updateLegSelectionOptions();
        requestRepaint();
        return;
    }
    
    // Freehand drawing / Waypoint preview
    if (appMode === 'DRAWING_ROUTE') {
        drawingHoverPt = mapPt;
        requestRepaint();
        return;
    }
}

function handleCanvasMouseUp(e) {
    if (isDraggingMap) {
        isDraggingMap = false;
        canvas.parentElement.classList.remove('mousedown');
        return;
    }
    
    if (draggedControl) {
        draggedControl = null;
        saveToLocalStorage();
        return;
    }
    
    if (appMode === 'DRAWING_ROUTE') {
        const dx = e.offsetX - dragStartScreen.x;
        const dy = e.offsetY - dragStartScreen.y;
        const clickDist = Math.sqrt(dx*dx + dy*dy);
        
        // If it is a click (not a drag)
        if (clickDist < 5) {
            const mapPt = screenToMap(e.offsetX, e.offsetY);
            const activeRoute = getActiveRoute();
            if (activeRoute) {
                const legs = getLegs();
                const leg = legs.find(l => l.index === activeLegIndex);
                if (leg) {
                    const targetScreenPt = mapToScreen(leg.endPt.x, leg.endPt.y);
                    const distToTarget = Math.sqrt(
                        (e.offsetX - targetScreenPt.x)**2 + 
                        (e.offsetY - targetScreenPt.y)**2
                    );
                    const snapToleranceScreen = 25;
                    
                    if (distToTarget <= snapToleranceScreen) {
                        // Clicked target control - snap and complete leg!
                        activeRoute.points.push({ x: leg.endPt.x, y: leg.endPt.y });
                        saveToLocalStorage();
                        showToast("Leg completed!", "success");
                        
                        if (isPracticeMode) {
                            practiceRoutes.push(activeRoute);
                            const nextLegIdx = activeLegIndex + 1;
                            if (nextLegIdx < legs.length) {
                                setActiveLeg(nextLegIdx);
                                startPracticeLegDrawing();
                            } else {
                                showPracticeCompletionSummary();
                            }
                        } else {
                            activeRouteId = null;
                            setAppMode('PAN_ZOOM');
                            updateRouteListAndHud();
                            updateRunnerComparisonList();
                        }
                    } else {
                        // Normal waypoint click
                        activeRoute.points.push(mapPt);
                        updateRouteListAndHud();
                    }
                }
            }
        }
        requestRepaint();
    }
}

function handleCanvasWheel(e) {
    if (!mapImage) return;
    e.preventDefault();
    
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    
    // Zoom centered around mouse cursor
    const mouseMapPt = screenToMap(e.offsetX, e.offsetY);
    
    viewTransform.zoom = Math.max(0.05, Math.min(20, viewTransform.zoom * zoomFactor));
    updateZoomHUD();
    
    // Shift center of view so mouse cursor stays on same map position
    const newMouseScreen = mapToScreen(mouseMapPt.x, mouseMapPt.y);
    const dx = newMouseScreen.x - e.offsetX;
    const dy = newMouseScreen.y - e.offsetY;
    
    const theta = -viewTransform.rotation;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const rx = (dx * cos - dy * sin) / viewTransform.zoom;
    const ry = (dx * sin + dy * cos) / viewTransform.zoom;
    
    viewTransform.x += rx;
    viewTransform.y += ry;
    
    requestRepaint();
}

function handleKeyDown(e) {
    // Spacebar Panning toggle
    if (e.code === 'Space') {
        if (document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            window.isSpacebarPressed = true;
            canvas.parentElement.classList.add('panning');
        }
    }
    
    // Q / E for rotation shortcuts
    if (document.activeElement.tagName !== 'INPUT') {
        if (e.key.toLowerCase() === 'q') rotateMap(-5);
        if (e.key.toLowerCase() === 'e') rotateMap(5);
        if (e.key.toLowerCase() === 'r') resetView();
        
        // Escape cancels current actions
        if (e.key === 'Escape') {
            if (appMode === 'RULER_CALIBRATING') cancelRulerCalibration();
            else if (appMode === 'DRAWING_ROUTE') {
                setAppMode('PAN_ZOOM');
                activeRouteId = null;
                updateRouteListAndHud();
            } else if (['ADD_START', 'ADD_CONTROL', 'ADD_FINISH', 'EDIT_COURSE'].includes(appMode)) {
                setAppMode('PAN_ZOOM');
            }
        }
        
        // Ctrl+Z Undo for drawing route points
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            if (appMode === 'DRAWING_ROUTE') {
                const activeRoute = getActiveRoute();
                if (activeRoute && activeRoute.points.length > 0) {
                    activeRoute.points.pop();
                    updateRouteListAndHud();
                    requestRepaint();
                }
            }
        }
    }
}

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        window.isSpacebarPressed = false;
        canvas.parentElement.classList.remove('panning');
    }
});

// --- Mode Manager UI Helper ---
function setAppMode(mode) {
    appMode = mode;
    
    // Reset buttons
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    elCalibrationBanner.style.display = 'none';
    elRulerCalHud.style.display = 'none';
    
    // Remove cursor classes
    canvas.parentElement.classList.remove('panning', 'drawing-route', 'course-edit', 'calibrating');
    
    let toolName = "Pan & Zoom";
    
    switch (mode) {
        case 'PAN_ZOOM':
            toolName = "Pan & Zoom";
            canvas.parentElement.classList.add('panning');
            break;
        case 'ADD_START':
            toolName = "Add Start Triangle";
            elBtnToolStart.classList.add('active');
            canvas.parentElement.classList.add('course-edit');
            break;
        case 'ADD_CONTROL':
            toolName = "Add Control Circle";
            elBtnToolControl.classList.add('active');
            canvas.parentElement.classList.add('course-edit');
            break;
        case 'ADD_FINISH':
            toolName = "Add Finish Double-Circle";
            elBtnToolFinish.classList.add('active');
            canvas.parentElement.classList.add('course-edit');
            break;
        case 'EDIT_COURSE':
            toolName = "Move/Edit Controls";
            elBtnToolSelectControl.classList.add('active');
            canvas.parentElement.classList.add('course-edit');
            break;
        case 'DRAWING_ROUTE':
            const r = getActiveRoute();
            toolName = `Drawing ${r ? r.name : 'Route'}`;
            canvas.parentElement.classList.add('drawing-route');
            break;
        case 'RULER_CALIBRATING':
            toolName = "Ruler Calibration";
            elCalibrationBanner.style.display = 'block';
            elRulerCalHud.style.display = 'block';
            canvas.parentElement.classList.add('calibrating');
            break;
    }
    
    elHudActiveTool.textContent = toolName;
    requestRepaint();
}

function applyModalCalibration() {
    const meters = parseFloat(elInputModalMeters.value) || 100;
    
    const dx = calibrationPoints[1].x - calibrationPoints[0].x;
    const dy = calibrationPoints[1].y - calibrationPoints[0].y;
    const pxLen = Math.sqrt(dx * dx + dy * dy);
    
    scale = meters / pxLen;
    updateCalibrationUI();
    elModalCalibrationInput.style.display = 'none';
    setAppMode('PAN_ZOOM');
    showToast(`Manual scale calibrated: 1 pixel = ${scale.toFixed(4)}m`, 'success');
    saveToLocalStorage();
}

// --- Rendering / Painting Engine ---
let repaintRequested = false;
function requestRepaint() {
    if (!repaintRequested) {
        repaintRequested = true;
        requestAnimationFrame(repaint);
    }
}

function repaint() {
    repaintRequested = false;
    if (!mapImage) {
        // Draw empty background grid
        ctx.fillStyle = '#0f0f15';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw base background (outer dark workspace)
    ctx.fillStyle = '#09090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save state for viewport transforms
    ctx.save();
    
    // Apply viewport transformations (Centered on viewTransform.x, viewTransform.y)
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(viewTransform.rotation);
    ctx.scale(viewTransform.zoom, viewTransform.zoom);
    ctx.translate(-viewTransform.x, -viewTransform.y);
    
    // Draw Map image
    ctx.drawImage(mapImage, 0, 0);
    
    // Draw Calibration line if in ruler mode
    if (appMode === 'RULER_CALIBRATING' || calibrationPoints.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = varColor('--accent-cyan');
        ctx.lineWidth = 2 / viewTransform.zoom;
        ctx.setLineDash([5 / viewTransform.zoom, 5 / viewTransform.zoom]);
        
        calibrationPoints.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.setLineDash([]); // reset
        
        // Draw point handles
        calibrationPoints.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 6 / viewTransform.zoom, 0, Math.PI*2);
            ctx.fillStyle = varColor('--accent-cyan');
            ctx.fill();
            ctx.lineWidth = 1 / viewTransform.zoom;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        });
    }
    
    ctx.restore();
    
    // DRAW COURSE & ROUTE CHOICES OVERLAY (Renders in Screen Space for crisp pixel-perfect lines!)
    drawCourseAndRoutesScreenSpace();
}

function varColor(cssVarName) {
    return getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
}

function drawCourseAndRoutesScreenSpace() {
    // 1. Draw connecting lines first (so they sit underneath control symbols)
    const legs = getLegs();
    
    ctx.lineWidth = SYMBOL_SIZES.lineWidth;
    ctx.strokeStyle = IOF_COLORS.purple;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    legs.forEach(leg => {
        // Project map points to screen space
        const p1 = mapToScreen(leg.startPt.x, leg.startPt.y);
        const p2 = mapToScreen(leg.endPt.x, leg.endPt.y);
        
        // Calculate circle clip sizes
        const isStart = leg.index === 0;
        const isFinish = leg.index === course.controls.length;
        
        const r1 = isStart ? SYMBOL_SIZES.startRadius : SYMBOL_SIZES.controlRadius;
        const r2 = isFinish ? SYMBOL_SIZES.finishOuterRadius : SYMBOL_SIZES.controlRadius;
        
        // Clip lines at circle boundaries to follow IOF sprint course standards
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > (r1 + r2)) {
            const ux = dx / dist;
            const uy = dy / dist;
            
            const startX = p1.x + ux * r1;
            const startY = p1.y + uy * r1;
            const endX = p2.x - ux * r2;
            const endY = p2.y - uy * r2;
            
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    });
    
    // 2. Draw Start (Triangle)
    if (course.start) {
        const s = mapToScreen(course.start.x, course.start.y);
        
        // Point triangle in direction of Control 1 if it exists
        let angle = -Math.PI / 2; // Default point UP
        if (course.controls.length > 0) {
            const c1 = mapToScreen(course.controls[0].x, course.controls[0].y);
            angle = Math.atan2(c1.y - s.y, c1.x - s.x);
        }
        
        ctx.lineWidth = SYMBOL_SIZES.controlLineWidth;
        ctx.strokeStyle = IOF_COLORS.purple;
        
        ctx.beginPath();
        const r = SYMBOL_SIZES.startRadius;
        // Equilateral triangle around center (s.x, s.y) rotated by angle
        for (let i = 0; i < 3; i++) {
            const theta = angle + (i * 2 * Math.PI) / 3;
            const x = s.x + r * Math.cos(theta);
            const y = s.y + r * Math.sin(theta);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    
    // 3. Draw Controls (Circles)
    course.controls.forEach(ctrl => {
        const c = mapToScreen(ctrl.x, ctrl.y);
        
        ctx.lineWidth = SYMBOL_SIZES.controlLineWidth;
        ctx.strokeStyle = IOF_COLORS.purple;
        
        // Control circle
        ctx.beginPath();
        ctx.arc(c.x, c.y, SYMBOL_SIZES.controlRadius, 0, Math.PI*2);
        ctx.stroke();
        
        // Control number (visual label outside the circle)
        ctx.fillStyle = IOF_COLORS.purple;
        ctx.font = 'bold 16px Outfit, Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Place text offset (default top-right, or we can adjust)
        // Draw white outline behind text for visibility on dark/busy map details
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText(ctrl.label, c.x + SYMBOL_SIZES.fontOffset, c.y - SYMBOL_SIZES.fontOffset + 4);
        ctx.fillText(ctrl.label, c.x + SYMBOL_SIZES.fontOffset, c.y - SYMBOL_SIZES.fontOffset + 4);
    });
    
    // 4. Draw Finish (Double Circle)
    if (course.finish) {
        const f = mapToScreen(course.finish.x, course.finish.y);
        
        ctx.lineWidth = SYMBOL_SIZES.controlLineWidth;
        ctx.strokeStyle = IOF_COLORS.purple;
        
        // Inner circle
        ctx.beginPath();
        ctx.arc(f.x, f.y, SYMBOL_SIZES.finishInnerRadius, 0, Math.PI*2);
        ctx.stroke();
        
        // Outer circle
        ctx.beginPath();
        ctx.arc(f.x, f.y, SYMBOL_SIZES.finishOuterRadius, 0, Math.PI*2);
        ctx.stroke();
    }
    
    // 5. Draw Routes Choices
    routes.forEach(route => {
        // Filter by course
        if (route.courseId !== activeCourseId) return;
        
        // Filter by runner visibility
        if (visibleRunners[route.runnerName] === false) return;
        
        if (!route.visible || route.points.length < 1) return;
        
        const isActiveLeg = route.legIndex === activeLegIndex;
        const isHighlightedRunner = window.highlightedRunner === route.runnerName;
        
        ctx.lineWidth = isHighlightedRunner ? 6 : (isActiveLeg ? 4 : 2);
        ctx.strokeStyle = route.color;
        
        // Set opacity based on leg focus and runner highlight
        if (window.highlightedRunner) {
            ctx.globalAlpha = isHighlightedRunner ? 1.0 : 0.15;
        } else {
            ctx.globalAlpha = isActiveLeg ? 1.0 : 0.35;
        }
        
        ctx.beginPath();
        route.points.forEach((pt, i) => {
            const scrPt = mapToScreen(pt.x, pt.y);
            if (i === 0) ctx.moveTo(scrPt.x, scrPt.y);
            else ctx.lineTo(scrPt.x, scrPt.y);
        });
        ctx.stroke();
        
        // Draw start/end dots on path
        if (route.points.length > 0) {
            const sPt = mapToScreen(route.points[0].x, route.points[0].y);
            ctx.beginPath();
            ctx.arc(sPt.x, sPt.y, 4, 0, Math.PI*2);
            ctx.fillStyle = route.color;
            ctx.fill();
        }
        
        ctx.globalAlpha = 1.0; // reset transparency
    });
    
    // 5b. Draw active route preview segment (dashed line to hover coordinate)
    if (appMode === 'DRAWING_ROUTE' && drawingHoverPt) {
        const activeRoute = getActiveRoute();
        if (activeRoute && activeRoute.points.length > 0) {
            const lastPt = activeRoute.points[activeRoute.points.length - 1];
            const p1 = mapToScreen(lastPt.x, lastPt.y);
            const p2 = mapToScreen(drawingHoverPt.x, drawingHoverPt.y);
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = 3;
            ctx.strokeStyle = activeRoute.color;
            ctx.setLineDash([6, 6]);
            ctx.stroke();
            ctx.setLineDash([]); // reset
        }
    }
    
    // 6. Highlight active dragged handle
    if (appMode === 'EDIT_COURSE') {
        const drawHandleGlow = (mx, my, rad) => {
            const scr = mapToScreen(mx, my);
            ctx.beginPath();
            ctx.arc(scr.x, scr.y, rad + 4, 0, Math.PI*2);
            ctx.strokeStyle = IOF_COLORS.startCyan;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };
        
        if (course.start) drawHandleGlow(course.start.x, course.start.y, SYMBOL_SIZES.startRadius);
        course.controls.forEach(c => drawHandleGlow(c.x, c.y, SYMBOL_SIZES.controlRadius));
        if (course.finish) drawHandleGlow(course.finish.x, course.finish.y, SYMBOL_SIZES.finishOuterRadius);
    }
}

// --- Steganography Export / Import ---
function exportPngWithMetadata() {
    if (!mapImage || !originalFileBuffer) {
        showToast("No map image loaded to export.", "warning");
        return;
    }
    
    // Sync current course state before export
    const curCourse = courses.find(c => c.id === activeCourseId);
    if (curCourse) {
        curCourse.start = course.start;
        curCourse.controls = [...course.controls];
        curCourse.finish = course.finish;
    }
    
    const project = {
        scale: scale,
        dpi: dpi,
        mapScale: mapScale,
        courses: courses,
        activeCourseId: activeCourseId,
        routes: routes,
        currentRunnerName: currentRunnerName
    };
    
    const jsonStr = JSON.stringify(project);
    const MAGIC_START = "\n---SPRINTROUTE-METADATA-START---\n";
    const MAGIC_END = "\n---SPRINTROUTE-METADATA-END---\n";
    
    // Create byte encoder for text data
    const encoder = new TextEncoder();
    const startBytes = encoder.encode(MAGIC_START);
    const jsonBytes = encoder.encode(jsonStr);
    const endBytes = encoder.encode(MAGIC_END);
    
    // We strip existing metadata first if this image already had it!
    let cleanOriginalBuffer = originalFileBuffer;
    const scannerResult = scanForEmbeddedMetadata(originalFileBuffer);
    if (scannerResult) {
        // Strip the previous metadata from the buffer
        const uint8 = new Uint8Array(originalFileBuffer);
        const searchStr = "---SPRINTROUTE-METADATA-START---";
        const decoder = new TextDecoder('utf-8');
        const scanLimit = 1024 * 1024 * 2;
        const sliceStart = Math.max(0, uint8.length - scanLimit);
        const tailBytes = uint8.subarray(sliceStart);
        const tailText = decoder.decode(tailBytes);
        
        const markerIdx = tailText.indexOf(searchStr);
        if (markerIdx !== -1) {
            // Find absolute index of metadata start in originalFileBuffer
            const totalBytesIndex = sliceStart + markerIdx;
            // Slice buffer up to the newlines before the metadata start
            cleanOriginalBuffer = originalFileBuffer.slice(0, totalBytesIndex);
        }
    }
    
    // Create new Blob combining cleaned image bytes + text metadata
    const blob = new Blob([
        cleanOriginalBuffer,
        startBytes,
        jsonBytes,
        endBytes
    ], { type: originalFileType || 'image/png' });
    
    // Trigger download
    const filenameNoExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || 'map';
    const extension = originalFileName.substring(originalFileName.lastIndexOf('.')) || '.png';
    const exportName = `${filenameNoExt}_sprintroute${extension}`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = exportName;
    link.click();
    
    showToast("Image exported with secure course & route metadata!", "success");
}

function exportJsonFile() {
    // Sync current course state before export
    const curCourse = courses.find(c => c.id === activeCourseId);
    if (curCourse) {
        curCourse.start = course.start;
        curCourse.controls = [...course.controls];
        curCourse.finish = course.finish;
    }
    
    const project = {
        scale: scale,
        dpi: dpi,
        mapScale: mapScale,
        courses: courses,
        activeCourseId: activeCourseId,
        routes: routes,
        currentRunnerName: currentRunnerName
    };
    
    const jsonStr = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    
    const filenameNoExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || 'map';
    const exportName = `${filenameNoExt}_metadata.json`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = exportName;
    link.click();
    
    showToast("JSON metadata backup exported.", "success");
}

function importJsonFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const project = JSON.parse(evt.target.result);
            loadProjectData(project);
            showToast("JSON metadata successfully imported!", "success");
            saveToLocalStorage();
        } catch (err) {
            console.error("JSON parsing error", err);
            showToast("Failed to parse JSON file.", "warning");
        }
    };
    reader.readAsText(file);
    // clear input
    elJsonFileInput.value = '';
}

function loadProjectData(project) {
    if (!project) return;
    
    scale = project.scale !== undefined ? project.scale : null;
    dpi = project.dpi !== undefined ? project.dpi : 300;
    mapScale = project.mapScale !== undefined ? project.mapScale : 4000;
    
    elInputDpi.value = dpi;
    elInputMapScale.value = mapScale;
    
    // Migrate single course to courses list
    if (project.courses) {
        courses = project.courses;
        activeCourseId = project.activeCourseId || courses[0].id;
    } else if (project.course) {
        courses = [
            {
                id: 'course-default',
                name: 'Course 1',
                start: project.course.start,
                controls: project.course.controls || [],
                finish: project.course.finish
            }
        ];
        activeCourseId = 'course-default';
    } else {
        courses = [
            {
                id: 'course-default',
                name: 'Course 1',
                start: null,
                controls: [],
                finish: null
            }
        ];
        activeCourseId = 'course-default';
    }
    
    const curCourse = courses.find(c => c.id === activeCourseId) || courses[0];
    course = curCourse;
    activeCourseId = curCourse.id;
    
    routes = project.routes || [];
    
    // Normalize routes for backward compatibility
    routes.forEach(r => {
        if (!r.courseId) r.courseId = activeCourseId;
        if (!r.runnerName) r.runnerName = 'Original Runner';
    });
    
    if (project.currentRunnerName) {
        currentRunnerName = project.currentRunnerName;
        elInputRunnerName.value = currentRunnerName;
    }
    
    updateCalibrationUI();
    updateCourseSelectDropdown();
    updateCourseList();
    updateLegSelectionOptions();
    updateRunnerComparisonList();
    
    activeRouteId = null;
    setActiveLeg(-1);
    
    requestRepaint();
}

// --- LocalStorage Session Backup ---
function saveToLocalStorage() {
    if (!mapImage) return;
    
    // Sync current course state before saving
    const curCourse = courses.find(c => c.id === activeCourseId);
    if (curCourse) {
        curCourse.start = course.start;
        curCourse.controls = [...course.controls];
        curCourse.finish = course.finish;
    }
    
    const project = {
        scale: scale,
        dpi: dpi,
        mapScale: mapScale,
        courses: courses,
        activeCourseId: activeCourseId,
        routes: routes,
        currentRunnerName: currentRunnerName,
        fileName: originalFileName,
        fileType: originalFileType
    };
    
    localStorage.setItem('sprintroute_backup', JSON.stringify(project));
}

function loadFromLocalStorage() {
    const raw = localStorage.getItem('sprintroute_backup');
    if (!raw) return;
    
    try {
        const backup = JSON.parse(raw);
        scale = backup.scale;
        dpi = backup.dpi;
        mapScale = backup.mapScale;
        originalFileName = backup.fileName || 'map.png';
        originalFileType = backup.fileType || 'image/png';
        
        if (backup.courses) {
            courses = backup.courses;
            activeCourseId = backup.activeCourseId || courses[0].id;
        } else if (backup.course) {
            courses = [
                {
                    id: 'course-default',
                    name: 'Course 1',
                    start: backup.course.start,
                    controls: backup.course.controls || [],
                    finish: backup.course.finish
                }
            ];
            activeCourseId = 'course-default';
        } else {
            courses = [
                {
                    id: 'course-default',
                    name: 'Course 1',
                    start: null,
                    controls: [],
                    finish: null
                }
            ];
            activeCourseId = 'course-default';
        }
        
        const curCourse = courses.find(c => c.id === activeCourseId) || courses[0];
        course = curCourse;
        activeCourseId = curCourse.id;
        
        routes = backup.routes || [];
        
        routes.forEach(r => {
            if (!r.courseId) r.courseId = activeCourseId;
            if (!r.runnerName) r.runnerName = 'Original Runner';
        });
        
        if (backup.currentRunnerName) {
            currentRunnerName = backup.currentRunnerName;
            elInputRunnerName.value = currentRunnerName;
        }
        
        elInputDpi.value = dpi;
        elInputMapScale.value = mapScale;
        
        showToast("Restored backup configurations. Drop your map image to load the visual canvas.", "info");
        
        updateCalibrationUI();
        updateCourseSelectDropdown();
        updateCourseList();
        updateLegSelectionOptions();
        updateRunnerComparisonList();
    } catch (err) {
        console.error("Error loading session backup", err);
    }
}

function resetSession() {
    localStorage.removeItem('sprintroute_backup');
    mapImage = null;
    originalFileBuffer = null;
    originalFileType = '';
    originalFileName = 'map.png';
    scale = null;
    
    courses = [
        {
            id: 'course-default',
            name: 'Course 1',
            start: null,
            controls: [],
            finish: null
        }
    ];
    activeCourseId = 'course-default';
    course = courses[0];
    
    routes = [];
    activeLegIndex = -1;
    activeRouteId = null;
    calibrationPoints = [];
    visibleRunners = {};
    
    elCanvas.style.display = 'none';
    elEmptyState.style.display = 'flex';
    elMapInfoCard.style.display = 'none';
    
    elPanelCalibration.classList.add('disabled');
    elPanelCourse.classList.add('disabled');
    elPanelPractice.classList.add('disabled');
    elPanelExport.classList.add('disabled');
    
    elRulerCalHud.style.display = 'none';
    elCalibrationResultCard.style.display = 'none';
    elCourseListContainer.style.display = 'none';
    elLegPracticeArea.style.display = 'none';
    
    updateZoomHUD();
    updateCourseSelectDropdown();
    updateRunnerComparisonList();
    requestRepaint();
    
    showToast("Session reset.", "info");
}

// --- Toast Notifications HUD ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto-remove toast after animations complete (4 seconds total)
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// --- Practice Mode Logic ---
function togglePracticeMode() {
    if (isPracticeMode) {
        stopPracticeMode();
    } else {
        startPracticeMode();
    }
}

function startPracticeMode() {
    const legs = getLegs();
    if (legs.length === 0) {
        showToast("Create a course first (needs Start and at least one Control or Finish)!", "warning");
        return;
    }
    
    isPracticeMode = true;
    practiceRoutes = [];
    
    // Change button style and label
    elBtnStartPractice.textContent = "Stop Practice Mode";
    elBtnStartPractice.style.background = "linear-gradient(135deg, var(--text-danger) 0%, #ef4444 100%)";
    elBtnStartPractice.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.25)";
    
    // Disable course edit tools so they don't modify course during practice
    elPanelCourse.classList.add('disabled');
    elPanelCalibration.classList.add('disabled');
    
    // Select first leg (Leg 0)
    setActiveLeg(0);
    
    // Auto-create a route choice for Leg 0
    startPracticeLegDrawing();
    
    showToast("Practice Mode started! Trace your route choices leg by leg.", "success");
}

function stopPracticeMode() {
    isPracticeMode = false;
    
    // Restore button style
    elBtnStartPractice.textContent = "Start Practice Mode";
    elBtnStartPractice.style.background = "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)";
    elBtnStartPractice.style.boxShadow = "0 4px 12px rgba(6, 182, 212, 0.25)";
    
    elPanelCourse.classList.remove('disabled');
    elPanelCalibration.classList.remove('disabled');
    
    setActiveLeg(-1);
    showToast("Practice Mode stopped.", "info");
}

function startPracticeLegDrawing() {
    if (!isPracticeMode || activeLegIndex === -1) return;
    
    const activeLegRoutes = routes.filter(r => r.legIndex === activeLegIndex);
    const letter = String.fromCharCode(65 + (activeLegRoutes.length % 26));
    
    const legs = getLegs();
    const leg = legs.find(l => l.index === activeLegIndex);
    const startPt = leg ? { x: leg.startPt.x, y: leg.startPt.y } : null;
    
    const newRoute = {
        id: 'route-practice-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        courseId: activeCourseId,
        runnerName: currentRunnerName,
        legIndex: activeLegIndex,
        name: `Route ${letter}`,
        points: startPt ? [startPt] : [],
        color: ROUTE_NEON_COLORS[activeLegRoutes.length % ROUTE_NEON_COLORS.length],
        visible: true
    };
    
    routes.push(newRoute);
    activeRouteId = newRoute.id;
    
    setAppMode('DRAWING_ROUTE');
    updateRouteListAndHud();
    requestRepaint();
}

function checkPracticeLegCompletion() {
    if (!isPracticeMode || activeLegIndex === -1) return;
    
    const activeRoute = getActiveRoute();
    if (!activeRoute || activeRoute.points.length < 2) return;
    
    const legs = getLegs();
    const leg = legs.find(l => l.index === activeLegIndex);
    if (!leg) return;
    
    const targetMapPt = leg.endPt;
    const lastRoutePt = activeRoute.points[activeRoute.points.length - 1];
    
    // Calculate distance in screen pixels
    const lastScreenPt = mapToScreen(lastRoutePt.x, lastRoutePt.y);
    const targetScreenPt = mapToScreen(targetMapPt.x, targetMapPt.y);
    
    const distScreen = Math.sqrt(
        (lastScreenPt.x - targetScreenPt.x)**2 + 
        (lastScreenPt.y - targetScreenPt.y)**2
    );
    
    const snapToleranceScreen = 25; // pixels click/drag tolerance on screen
    
    if (distScreen <= snapToleranceScreen) {
        practiceRoutes.push(activeRoute);
        
        // Auto-snap route end to target control center
        activeRoute.points[activeRoute.points.length - 1] = { x: targetMapPt.x, y: targetMapPt.y };
        saveToLocalStorage();
        
        const nextLegIdx = activeLegIndex + 1;
        if (nextLegIdx < legs.length) {
            showToast(`Leg ${activeLegIndex + 1} completed! Snapping to next leg...`, "success");
            setActiveLeg(nextLegIdx);
            startPracticeLegDrawing();
        } else {
            showToast("Course completed! Well done!", "success");
            showPracticeCompletionSummary();
        }
    }
}

function showPracticeCompletionSummary() {
    isPracticeMode = false;
    
    // Restore button style
    elBtnStartPractice.textContent = "Start Practice Mode";
    elBtnStartPractice.style.background = "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)";
    elBtnStartPractice.style.boxShadow = "0 4px 12px rgba(6, 182, 212, 0.25)";
    
    elPanelCourse.classList.remove('disabled');
    elPanelCalibration.classList.remove('disabled');
    
    elPracticeSummaryContent.innerHTML = '';
    
    let totalLengthMeters = 0;
    let totalStraightMeters = 0;
    
    const legs = getLegs();
    
    legs.forEach(leg => {
        const route = practiceRoutes.find(r => r.legIndex === leg.index);
        if (!route) return;
        
        const routeLenMeters = calculateRouteLength(route);
        totalLengthMeters += routeLenMeters;
        
        const dx = leg.endPt.x - leg.startPt.x;
        const dy = leg.endPt.y - leg.startPt.y;
        const straightPix = Math.sqrt(dx*dx + dy*dy);
        const straightMeters = scale !== null ? straightPix * scale : 0;
        totalStraightMeters += straightMeters;
        
        const efficiency = straightMeters > 0 ? (straightMeters / routeLenMeters) * 100 : 100;
        const estTimeStr = calculateEstTime(routeLenMeters);
        
        const row = document.createElement('div');
        row.className = 'result-row';
        row.style.borderBottom = '1px solid var(--border-color)';
        row.style.paddingBottom = '6px';
        row.innerHTML = `
            <div style="display: flex; flex-direction: column;">
                <strong style="color: ${route.color}; font-size: 12px;">Leg ${leg.index + 1}: ${leg.name.replace('Control ', '')}</strong>
                <span style="color: var(--text-muted); font-size: 10px;">Straight: ${Math.round(straightMeters)}m • Drawn: ${Math.round(routeLenMeters)}m</span>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; justify-content: center;">
                <strong style="color: var(--text-primary); font-size: 12px;">${estTimeStr}</strong>
                <span style="color: var(--accent-green); font-size: 10px; font-weight: 600;">${Math.round(efficiency)}% Eff</span>
            </div>
        `;
        elPracticeSummaryContent.appendChild(row);
    });
    
    const totalRow = document.createElement('div');
    totalRow.className = 'result-row';
    totalRow.style.marginTop = '10px';
    totalRow.style.paddingTop = '10px';
    totalRow.style.borderTop = '2px solid var(--border-color)';
    
    const avgEfficiency = totalLengthMeters > 0 ? (totalStraightMeters / totalLengthMeters) * 100 : 100;
    const totalTimeStr = calculateEstTime(totalLengthMeters);
    
    totalRow.innerHTML = `
        <div style="display: flex; flex-direction: column;">
            <strong style="font-size: 13px; color: var(--accent-magenta);">TOTAL COURSE STATS</strong>
            <span style="color: var(--text-muted); font-size: 10px;">Total Drawn: ${Math.round(totalLengthMeters)}m</span>
        </div>
        <div style="text-align: right; display: flex; flex-direction: column;">
            <strong style="font-size: 14px; color: var(--accent-magenta);">${totalTimeStr}</strong>
            <span style="color: var(--accent-green); font-size: 10px; font-weight: 600;">${Math.round(avgEfficiency)}% Avg Eff</span>
        </div>
    `;
    elPracticeSummaryContent.appendChild(totalRow);
    
    elModalPracticeComplete.style.display = 'flex';
    
    updateRunnerComparisonList(); // Refresh runner leaderboard on completion!
    setActiveLeg(-1);
    resetView();
}



// --- Metadata Found Modal ---
function showMetadataFoundModal(project) {
    elMetadataCoursesSummary.innerHTML = '';
    
    const projectCourses = project.courses || [];
    const projectRoutes = project.routes || [];
    
    if (projectCourses.length === 0) {
        elMetadataCoursesSummary.innerHTML = '<p style="color: var(--text-muted); text-align: center; font-size: 12px;">No courses found in metadata.</p>';
    } else {
        projectCourses.forEach(c => {
            const courseRoutes = projectRoutes.filter(r => r.courseId === c.id || (!r.courseId && c.id === projectCourses[0].id));
            
            // Count unique runners
            const runners = [...new Set(courseRoutes.map(r => r.runnerName).filter(Boolean))];
            const controlCount = (c.controls || []).length;
            const hasStart = !!c.start;
            const hasFinish = !!c.finish;
            
            const card = document.createElement('div');
            card.className = 'info-card';
            card.style.cssText = `
                padding: 12px 16px;
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                transition: border-color 0.2s;
            `;
            
            const left = document.createElement('div');
            left.innerHTML = `
                <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">${c.name}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                    ${hasStart ? '▲ Start' : ''} 
                    ${controlCount > 0 ? `• ${controlCount} Control${controlCount > 1 ? 's' : ''}` : ''} 
                    ${hasFinish ? '• ◎ Finish' : ''}
                </div>
            `;
            
            const right = document.createElement('div');
            right.style.cssText = 'text-align: right;';
            
            if (runners.length > 0) {
                right.innerHTML = `
                    <div style="font-size: 12px; color: var(--accent-cyan); font-weight: 600;">${courseRoutes.length} route${courseRoutes.length !== 1 ? 's' : ''}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">by: ${runners.join(', ')}</div>
                `;
            } else {
                right.innerHTML = `<div style="font-size: 11px; color: var(--text-muted);">No routes yet</div>`;
            }
            
            card.appendChild(left);
            card.appendChild(right);
            
            // Clicking a course card switches to that course
            card.addEventListener('click', () => {
                selectCourse(c.id);
                elModalMetadataFound.style.display = 'none';
            });
            card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--accent-magenta)'; });
            card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border-color)'; });
            
            elMetadataCoursesSummary.appendChild(card);
        });
    }
    
    elModalMetadataFound.style.display = 'flex';
}

// --- Course Switcher Logic ---
function updateCourseSelectDropdown() {
    elSelectCourse.innerHTML = '';
    courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        elSelectCourse.appendChild(opt);
    });
    elSelectCourse.value = activeCourseId;
}

function selectCourse(courseId) {
    // Sync current course state back to courses array before switching
    const curCourse = courses.find(c => c.id === activeCourseId);
    if (curCourse) {
        curCourse.start = course.start;
        curCourse.controls = [...course.controls];
        curCourse.finish = course.finish;
    }
    
    activeCourseId = courseId;
    const nextCourse = courses.find(c => c.id === courseId);
    if (nextCourse) {
        course = nextCourse; // Update active course pointer
    }
    
    // Reset selections
    activeLegIndex = -1;
    activeRouteId = null;
    setAppMode('PAN_ZOOM');
    
    // Update UI elements
    updateCourseList();
    updateLegSelectionOptions();
    updateRunnerComparisonList();
    
    saveToLocalStorage();
    requestRepaint();
    
    showToast(`Switched to course: ${course.name}`, "info");
}

function createNewCourse() {
    const name = prompt("Enter new course name:", `Course ${courses.length + 1}`);
    if (!name) return;
    
    const newId = 'course-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const newCourse = {
        id: newId,
        name: name,
        start: null,
        controls: [],
        finish: null
    };
    
    courses.push(newCourse);
    updateCourseSelectDropdown();
    selectCourse(newId);
}

function renameCourse() {
    const curCourse = courses.find(c => c.id === activeCourseId);
    if (!curCourse) return;
    
    const newName = prompt("Rename course:", curCourse.name);
    if (!newName) return;
    
    curCourse.name = newName;
    updateCourseSelectDropdown();
    saveToLocalStorage();
}

function deleteCourse() {
    if (courses.length <= 1) {
        showToast("Cannot delete the only remaining course.", "warning");
        return;
    }
    
    if (confirm(`Are you sure you want to delete course "${course.name}" and all its routes?`)) {
        // Remove routes for this course
        routes = routes.filter(r => r.courseId !== activeCourseId);
        
        // Remove course
        courses = courses.filter(c => c.id !== activeCourseId);
        
        // Select first course
        const firstCourse = courses[0];
        selectCourse(firstCourse.id);
        updateCourseSelectDropdown();
    }
}

// --- Runner Comparison Leaderboard Logic ---
function updateRunnerComparisonList() {
    elRunnerComparisonList.innerHTML = '';
    
    // Group routes by runnerName for the activeCourseId
    const runnerRoutesMap = {};
    routes.forEach(route => {
        if (route.courseId !== activeCourseId || route.points.length < 2) return;
        
        if (!runnerRoutesMap[route.runnerName]) {
            runnerRoutesMap[route.runnerName] = [];
        }
        runnerRoutesMap[route.runnerName].push(route);
    });
    
    const runners = Object.keys(runnerRoutesMap);
    
    if (runners.length === 0) {
        elRunnerComparisonList.innerHTML = '<p class="section-desc" style="text-align: center; margin: 10px 0; font-size: 10px;">No runner routes recorded yet.</p>';
        return;
    }
    
    // Compute overall course stats for each runner
    const leaderboard = runners.map(name => {
        let totalLength = 0;
        runnerRoutesMap[name].forEach(r => {
            totalLength += calculateRouteLength(r);
        });
        
        // Default visibility to true if not defined
        if (visibleRunners[name] === undefined) {
            visibleRunners[name] = true;
        }
        
        return {
            name: name,
            totalLength: totalLength,
            timeStr: calculateEstTime(totalLength)
        };
    });
    
    // Sort by total length (shortest route wins)
    leaderboard.sort((a, b) => a.totalLength - b.totalLength);
    
    // Render items
    leaderboard.forEach(runner => {
        const item = document.createElement('div');
        item.className = 'control-list-item';
        item.style.padding = '6px 10px';
        item.style.cursor = 'pointer';
        
        const left = document.createElement('div');
        left.className = 'control-item-left';
        left.style.gap = '6px';
        
        // Visibility checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = visibleRunners[runner.name] !== false;
        checkbox.style.cursor = 'pointer';
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            visibleRunners[runner.name] = e.target.checked;
            updateRouteListAndHud();
            updateRunnerComparisonList();
            requestRepaint();
        });
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'control-item-name';
        nameSpan.style.fontSize = '11px';
        nameSpan.textContent = runner.name;
        if (runner.name === currentRunnerName) {
            nameSpan.innerHTML += ' <span style="color: var(--accent-cyan); font-size: 9px; font-weight: bold;">(You)</span>';
        }
        
        left.appendChild(checkbox);
        left.appendChild(nameSpan);
        
        const right = document.createElement('div');
        right.style.fontSize = '10px';
        right.style.color = 'var(--text-secondary)';
        right.style.fontWeight = '600';
        right.textContent = scale !== null ? `${Math.round(runner.totalLength)}m (${runner.timeStr})` : `${Math.round(runner.totalLength)}px`;
        
        item.appendChild(left);
        item.appendChild(right);
        
        // Click item to toggle highlights
        item.addEventListener('click', () => {
            showToast(`Highlighting routes for: ${runner.name}`, 'info');
            highlightRunnerRoutes(runner.name);
        });
        
        elRunnerComparisonList.appendChild(item);
    });
}

function highlightRunnerRoutes(runnerName) {
    window.highlightedRunner = runnerName;
    requestRepaint();
    setTimeout(() => {
        window.highlightedRunner = null;
        requestRepaint();
    }, 1800);
}
