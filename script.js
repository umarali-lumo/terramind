/* =========================================================
   TERRAMIND
   FULL FRONTEND
   ========================================================= */


/* =========================================================
   STATE
   ========================================================= */

const API_BASE = "";

let fields = [];

let selectedField = null;

let digitalTwinActive = false;

let creatingField = false;

let pendingPolygon = null;

let pendingGeoJSON = null;

let activeDrawer = null;

let searchMarker = null;

let currentLocationMarker = null;

let currentAccuracyCircle = null;

let selectedLocation = null;

let weatherContext = null;

let weatherRequestId = 0;


/* =========================================================
   DEMO DATA
   ========================================================= */

const demoFields = [

    {
        id: "demo-1",

        name: "Field A",

        crop: "Tomato",

        health: 88,

        waterStress: "Low",

        diseaseRisk: 8,

        disease: "No crop image analyzed",

        confidence: 0,

        recommendation:
            "Upload a crop image to establish the computer-vision baseline.",

        irrigation: "Optimal",

        growthStage: "Vegetative",

        coordinates: [
            [31.5241, 74.3505],
            [31.5260, 74.3535],
            [31.5243, 74.3560],
            [31.5225, 74.3530]
        ],

        area: 10800
    },

    {
        id: "demo-2",

        name: "Field B",

        crop: "Tomato",

        health: 64,

        waterStress: "Moderate",

        diseaseRisk: 31,

        disease: "Early Blight",

        confidence: 94,

        recommendation:
            "Inspect Field B within 24 hours and confirm the potential disease finding.",

        irrigation: "Increase",

        growthStage: "Flowering",

        coordinates: [
            [31.5205, 74.3570],
            [31.5225, 74.3605],
            [31.5198, 74.3630],
            [31.5180, 74.3595]
        ],

        area: 9200
    }

];


/* =========================================================
   MAP
   ========================================================= */

const map =
    L.map(
        "map",
        {
            zoomControl: false,
            attributionControl: true
        }
    )
    .setView(
        [30.3753, 69.3451],
        6
    );


/* =========================================================
   SATELLITE
   ========================================================= */

const satellite =
    L.tileLayer(

        "https://server.arcgisonline.com/ArcGIS/rest/services/" +
        "World_Imagery/MapServer/tile/{z}/{y}/{x}",

        {
            maxZoom: 19,
            attribution: "Tiles © Esri"
        }

    )
    .addTo(map);


/* =========================================================
   LAYERS
   ========================================================= */

const fieldLayer =
    L.featureGroup().addTo(map);

const drawingLayer =
    L.featureGroup().addTo(map);

const digitalTwinLayer =
    L.featureGroup().addTo(map);


/* =========================================================
   STARTUP
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);


async function initializeApp() {

    loadFields();

    renderFields();

    updateFarmStats();

    updateFarmRiskPanel();

    updateDigitalTwinUI();

    updateMapModeButtons(
        "satellite"
    );


    updateSystemStatus(
        "Checking AI..."
    );


    updateLocationText(
        30.3753,
        69.3451,
        "Pakistan"
    );


    await loadWeather(
        30.3753,
        69.3451,
        "Pakistan"
    );


    await checkAIBackend();


    setTimeout(
        () => {

            map.invalidateSize();

            map.fitBounds(
                [
                    [23.5, 60.8],
                    [37.1, 77.8]
                ],
                {
                    padding: [15, 15]
                }
            );

        },
        250
    );

}


/* =========================================================
   SYSTEM STATUS
   ========================================================= */

function updateSystemStatus(
    message
) {

    const el =
        document.getElementById(
            "systemStatusText"
        );


    if (el) {

        el.textContent =
            message;

    }

}


/* =========================================================
   STORAGE
   ========================================================= */

function loadFields() {

    const saved =
        localStorage.getItem(
            "terramind_fields"
        );


    if (!saved) {

        fields =
            JSON.parse(
                JSON.stringify(
                    demoFields
                )
            );

        saveFields();

        return;

    }


    try {

        const parsed =
            JSON.parse(
                saved
            );


        if (
            Array.isArray(
                parsed
            )
        ) {

            fields =
                parsed;

        } else {

            resetDemoFields();

        }

    } catch (error) {

        console.error(
            "Field storage error:",
            error
        );

        resetDemoFields();

    }

}


function resetDemoFields() {

    fields =
        JSON.parse(
            JSON.stringify(
                demoFields
            )
        );

    saveFields();

}


function saveFields() {

    localStorage.setItem(

        "terramind_fields",

        JSON.stringify(
            fields
        )

    );

}


/* =========================================================
   FIELD STYLE
   ========================================================= */

function getFieldStyle(
    field
) {

    if (
        field.health < 60
    ) {

        return {
            color: "#e96c61",
            fillColor: "#e96c61",
            fillOpacity:
                digitalTwinActive
                    ? 0.08
                    : 0.24,
            weight: 2
        };

    }


    if (
        field.health < 80
    ) {

        return {
            color: "#e8b94e",
            fillColor: "#e8b94e",
            fillOpacity:
                digitalTwinActive
                    ? 0.08
                    : 0.18,
            weight: 2
        };

    }


    return {
        color: "#8bd45c",
        fillColor: "#8bd45c",
        fillOpacity:
            digitalTwinActive
                ? 0.08
                : 0.16,
        weight: 2
    };

}


/* =========================================================
   FIELD RENDERING
   ========================================================= */

function renderFields() {

    fieldLayer.clearLayers();


    fields.forEach(
        field => {

            if (
                !Array.isArray(
                    field.coordinates
                ) ||
                field.coordinates.length < 3
            ) {

                return;

            }


            const polygon =
                L.polygon(
                    field.coordinates,
                    getFieldStyle(field)
                );


            polygon.addTo(
                fieldLayer
            );


            polygon.bindTooltip(

                `
                <strong>
                    ${escapeHTML(field.name)}
                </strong>

                <br>

                ${escapeHTML(field.crop)}

                · Health ${field.health}
                `,

                {
                    direction: "center",
                    className: "terramind-tooltip"
                }

            );


            polygon.on(
                "click",
                () => {

                    selectField(
                        field.id
                    );

                }
            );


            if (
                selectedField &&
                selectedField.id === field.id
            ) {

                polygon.setStyle({

                    color: "#ffffff",

                    weight: 3

                });

            }

        }
    );

}


/* =========================================================
   SELECT FIELD
   ========================================================= */

function selectField(
    fieldId
) {

    const field =
        fields.find(
            item =>
                item.id === fieldId
        );


    if (!field) {

        return;

    }


    selectedField =
        field;


    updateFieldModal(
        field
    );


    renderFields();

    renderDigitalTwin();

    focusSelectedField();

    openFieldModal();


    const center =
        getFieldCenter(
            field
        );


    if (center) {

        loadWeather(
            center.lat,
            center.lng,
            field.name
        );

    }

}


/* =========================================================
   FIELD MODAL
   ========================================================= */

function openFieldModal() {

    document
        .getElementById(
            "fieldModal"
        )
        .classList
        .add("show");

}


function closeFieldModal() {

    document
        .getElementById(
            "fieldModal"
        )
        .classList
        .remove("show");

}


/* =========================================================
   UPDATE FIELD MODAL
   ========================================================= */

function updateFieldModal(
    field
) {

    document
        .getElementById(
            "fieldModalName"
        )
        .textContent =
        field.name;


    document
        .getElementById(
            "fieldModalCrop"
        )
        .textContent =
        `${field.crop} · ${
            field.growthStage ||
            "Vegetative"
        }`;


    document
        .getElementById(
            "fieldModalHealth"
        )
        .textContent =
        clamp(
            Number(field.health) || 0,
            0,
            100
        );


    document
        .getElementById(
            "fieldDiseaseRisk"
        )
        .textContent =
        `${field.diseaseRisk || 0}%`;


    document
        .getElementById(
            "fieldWaterStress"
        )
        .textContent =
        field.waterStress ||
        "Low";


    document
        .getElementById(
            "fieldEnvironmentStress"
        )
        .textContent =
        getEnvironmentStressText();


    document
        .getElementById(
            "fieldArea"
        )
        .textContent =
        getFieldAreaText(
            field
        );


    document
        .getElementById(
            "fieldRiskTitle"
        )
        .textContent =

        field.health < 60
            ? "High Field Risk"
            : field.health < 80
                ? "Moderate Field Risk"
                : "Field Status Stable";


    document
        .getElementById(
            "fieldRiskDescription"
        )
        .textContent =

        `${field.disease || "No disease detected"} · ${
            field.confidence || 0
        }% model confidence`;


    document
        .getElementById(
            "fieldRecommendationTitle"
        )
        .textContent =

        field.health < 60
            ? "Intervention within 24 hours"
            : field.health < 80
                ? "Increase monitoring"
                : "Continue monitoring";


    document
        .getElementById(
            "fieldRecommendation"
        )
        .textContent =

        field.recommendation ||
        "Continue monitoring the field.";


    updateDiseaseCard(
        field
    );


    updatePredictionChart(
        field
    );

}


/* =========================================================
   DISEASE CARD
   ========================================================= */

function updateDiseaseCard(
    field
) {

    const title =
        document.getElementById(
            "diseaseResultTitle"
        );


    const confidence =
        document.getElementById(
            "diseaseResultConfidence"
        );


    const score =
        document.getElementById(
            "diseaseResultScore"
        );


    if (
        !field.disease ||
        field.disease ===
            "No crop image analyzed"
    ) {

        title.textContent =
            "No crop image analyzed";


        confidence.textContent =
            "Upload a leaf image";


        score.textContent =
            "—";


        return;

    }


    title.textContent =
        `${field.crop}: ${field.disease}`;


    confidence.textContent =
        `${field.confidence || 0}% model confidence`;


    score.textContent =
        `${field.diseaseRisk || 0}%`;

}


/* =========================================================
   WEATHER PREDICTION
   ========================================================= */

function updatePredictionChart(
    field
) {

    const base =
        clamp(
            Number(field.health) || 0,
            0,
            100
        );


    const environment =
        weatherContext
            ? weatherContext.environmentStress
            : 0;


    const disease =
        Number(
            field.diseaseRisk
        ) || 0;


    const p24 =
        clamp(
            base -
            3 -
            environment * 0.05 -
            disease * 0.04,
            0,
            100
        );


    const p48 =
        clamp(
            base -
            6 -
            environment * 0.08 -
            disease * 0.06,
            0,
            100
        );


    const p72 =
        clamp(
            base -
            10 -
            environment * 0.12 -
            disease * 0.08,
            0,
            100
        );


    setChart(
        "chartNow",
        "chartNowValue",
        base
    );


    setChart(
        "chart24",
        "chart24Value",
        p24
    );


    setChart(
        "chart48",
        "chart48Value",
        p48
    );


    setChart(
        "chart72",
        "chart72Value",
        p72
    );

}


function setChart(
    barId,
    valueId,
    value
) {

    document
        .getElementById(
            barId
        )
        .style
        .height =
        `${Math.max(8, value)}%`;


    document
        .getElementById(
            valueId
        )
        .textContent =
        Math.round(
            value
        );

}


/* =========================================================
   DIGITAL TWIN
   ========================================================= */

function toggleDigitalTwin() {

    digitalTwinActive =
        !digitalTwinActive;


    updateDigitalTwinUI();


    updateMapModeButtons(

        digitalTwinActive
            ? "digital"
            : "satellite"

    );


    renderFields();

    renderDigitalTwin();


    if (
        digitalTwinActive &&
        fields.length
    ) {

        const highestRisk =
            [...fields]
                .sort(
                    (a, b) =>
                        a.health -
                        b.health
                )[0];


        selectField(
            highestRisk.id
        );

    }


}


/* =========================================================
   MAP MODES
   ========================================================= */

function setMapMode(
    mode
) {

    digitalTwinActive =
        mode !== "satellite";


    updateMapModeButtons(
        mode
    );


    updateDigitalTwinUI();


    renderFields();

    renderDigitalTwin();


    if (
        digitalTwinActive &&
        fields.length
    ) {

        const highestRisk =
            [...fields]
                .sort(
                    (a, b) =>
                        a.health -
                        b.health
                )[0];


        selectField(
            highestRisk.id
        );

    } else {

        closeFieldModal();

    }

}


function updateMapModeButtons(
    mode
) {

    [
        "satelliteMode",
        "digitalMode",
        "riskMode"
    ]
    .forEach(
        id => {

            document
                .getElementById(
                    id
                )
                .classList
                .remove(
                    "map-mode-active"
                );

        }
    );


    if (
        mode === "satellite"
    ) {

        document
            .getElementById(
                "satelliteMode"
            )
            .classList
            .add(
                "map-mode-active"
            );

    }


    if (
        mode === "digital"
    ) {

        document
            .getElementById(
                "digitalMode"
            )
            .classList
            .add(
                "map-mode-active"
            );

    }


    if (
        mode === "risk"
    ) {

        document
            .getElementById(
                "riskMode"
            )
            .classList
            .add(
                "map-mode-active"
            );

    }

}


/* =========================================================
   DIGITAL TWIN UI
   ========================================================= */

function updateDigitalTwinUI() {

    const state =
        document.getElementById(
            "dtNavState"
        );


    const legend =
        document.getElementById(
            "digitalLegend"
        );


    if (
        digitalTwinActive
    ) {

        state.textContent =
            "ON";


        state.classList.add(
            "on"
        );


        legend.classList.remove(
            "hidden"
        );


        satellite.setOpacity(
            0.45
        );

    } else {

        state.textContent =
            "OFF";


        state.classList.remove(
            "on"
        );


        legend.classList.add(
            "hidden"
        );


        digitalTwinLayer.clearLayers();


        satellite.setOpacity(
            1
        );

    }

}


/* =========================================================
   DIGITAL TWIN GRID
   ========================================================= */

function renderDigitalTwin() {

    digitalTwinLayer.clearLayers();


    if (
        !digitalTwinActive
    ) {

        return;

    }


    fields.forEach(
        field => {

            if (
                !field.coordinates
            ) {

                return;

            }


            const polygon =
                L.polygon(
                    field.coordinates
                );


            const bounds =
                polygon.getBounds();


            const south =
                bounds.getSouth();


            const north =
                bounds.getNorth();


            const west =
                bounds.getWest();


            const east =
                bounds.getEast();


            const rows = 5;

            const cols = 5;


            for (
                let row = 0;
                row < rows;
                row++
            ) {

                for (
                    let col = 0;
                    col < cols;
                    col++
                ) {

                    let health =
                        Number(
                            field.health
                        ) || 0;


                    health +=
                        (
                            row * 17 +
                            col * 13
                        ) %
                        15 -
                        7;


                    const color =
                        getHealthColor(
                            health
                        );


                    const lat1 =
                        south +
                        (
                            north -
                            south
                        ) *
                        row /
                        rows;


                    const lat2 =
                        south +
                        (
                            north -
                            south
                        ) *
                        (row + 1) /
                        rows;


                    const lng1 =
                        west +
                        (
                            east -
                            west
                        ) *
                        col /
                        cols;


                    const lng2 =
                        west +
                        (
                            east -
                            west
                        ) *
                        (col + 1) /
                        cols;


                    L.rectangle(
                        [
                            [lat1, lng1],
                            [lat2, lng2]
                        ],
                        {
                            color,
                            fillColor: color,
                            fillOpacity: 0.22,
                            weight: 0.6,
                            className: "dt-zone",
                            interactive: false
                        }
                    ).addTo(
                        digitalTwinLayer
                    );

                }

            }


            if (
                field.health < 70
            ) {

                L.circle(
                    polygon.getCenter(),
                    {
                        radius: 48,
                        color: "#e96c61",
                        fillColor: "#e96c61",
                        fillOpacity: 0.25,
                        weight: 1,
                        className: "risk-hotspot",
                        interactive: false
                    }
                ).addTo(
                    digitalTwinLayer
                );

            }

        }
    );

}


/* =========================================================
   HEALTH COLOR
   ========================================================= */

function getHealthColor(
    health
) {

    if (
        health >= 80
    ) {

        return "#8bd45c";

    }


    if (
        health >= 60
    ) {

        return "#e8b94e";

    }


    return "#e96c61";

}


/* =========================================================
   FIELD DRAWING
   ========================================================= */

function startFieldCreation() {

    if (
        creatingField
    ) {

        return;

    }


    creatingField =
        true;


    pendingPolygon =
        null;


    pendingGeoJSON =
        null;


    drawingLayer.clearLayers();


    document
        .getElementById(
            "drawingBanner"
        )
        .classList
        .add(
            "show"
        );


    activeDrawer =
        new L.Draw.Polygon(
            map,
            {
                allowIntersection: false,

                showArea: false,

                shapeOptions: {
                    color: "#8bd45c",
                    fillColor: "#8bd45c",
                    fillOpacity: 0.22,
                    weight: 2
                }
            }
        );


    activeDrawer.enable();

}


map.on(
    L.Draw.Event.CREATED,
    event => {

        if (
            !creatingField
        ) {

            return;

        }


        pendingPolygon =
            event.layer;


        pendingGeoJSON =
            pendingPolygon.toGeoJSON();


        drawingLayer.clearLayers();


        drawingLayer.addLayer(
            pendingPolygon
        );


        creatingField =
            false;


        activeDrawer =
            null;


        document
            .getElementById(
                "drawingBanner"
            )
            .classList
            .remove(
                "show"
            );


        const area =
            calculateArea(
                pendingPolygon
            );


        const perimeter =
            calculatePerimeter(
                pendingPolygon
            );


        const center =
            getPolygonCentroid(
                pendingPolygon
            );


        document
            .getElementById(
                "newFieldArea"
            )
            .textContent =
            formatArea(
                area
            );


        document
            .getElementById(
                "newFieldPerimeter"
            )
            .textContent =
            formatDistance(
                perimeter
            );


        document
            .getElementById(
                "newFieldCoordinates"
            )
            .textContent =

            `${center.lat.toFixed(4)}, ${
                center.lng.toFixed(4)
            }`;


        const saveButton =
            document.getElementById(
                "saveFieldButton"
            );


        saveButton.disabled =
            false;


        saveButton.classList
            .remove(
                "disabled"
            );


        document
            .getElementById(
                "createFieldModal"
            )
            .classList
            .add(
                "show"
            );

    }
);


/* =========================================================
   SAVE NEW FIELD
   ========================================================= */

async function saveNewField() {

    if (
        !pendingPolygon
    ) {

        return;

    }


    const name =
        document
            .getElementById(
                "fieldName"
            )
            .value
            .trim();


    const crop =
        document
            .getElementById(
                "cropType"
            )
            .value;


    if (
        !name
    ) {

        document
            .getElementById(
                "fieldName"
            )
            .focus();


        return;

    }


    const center =
        getPolygonCentroid(
            pendingPolygon
        );


    const field = {

        id:
            `field-${Date.now()}`,

        name,

        crop,

        health:
            100,

        waterStress:
            "Very Low",

        diseaseRisk:
            0,

        disease:
            "No crop image analyzed",

        confidence:
            0,

        recommendation:
            "Upload a crop image to establish the computer-vision baseline.",

        irrigation:
            "Optimal",

        growthStage:
            "Vegetative",

        coordinates:
            pendingPolygon
                .getLatLngs()[0]
                .map(
                    point => [
                        point.lat,
                        point.lng
                    ]
                ),

        area:
            calculateArea(
                pendingPolygon
            ),

        centroid: {
            lat: center.lat,
            lng: center.lng
        },

        geojson:
            pendingGeoJSON,

        createdAt:
            new Date().toISOString()

    };


    fields.push(
        field
    );


    saveFields();


    drawingLayer.clearLayers();


    pendingPolygon =
        null;


    pendingGeoJSON =
        null;


    closeCreateFieldModal();


    selectedField =
        field;


    renderFields();

    updateFarmStats();

    updateFarmRiskPanel();

    focusSelectedField();


    await loadWeather(
        center.lat,
        center.lng,
        field.name
    );


    updateFieldModal(
        field
    );


    openFieldModal();

}


/* =========================================================
   CLOSE CREATE
   ========================================================= */

function closeCreateFieldModal() {

    document
        .getElementById(
            "createFieldModal"
        )
        .classList
        .remove(
            "show"
        );


    drawingLayer.clearLayers();


    pendingPolygon =
        null;


    pendingGeoJSON =
        null;


    creatingField =
        false;


    if (
        activeDrawer
    ) {

        activeDrawer.disable();

        activeDrawer =
            null;

    }


    document
        .getElementById(
            "drawingBanner"
        )
        .classList
        .remove(
            "show"
        );


    const saveButton =
        document.getElementById(
            "saveFieldButton"
        );


    saveButton.disabled =
        true;


    saveButton.classList
        .add(
            "disabled"
        );


    document
        .getElementById(
            "fieldName"
        )
        .value =
        "";


    document
        .getElementById(
            "newFieldArea"
        )
        .textContent =
        "—";


    document
        .getElementById(
            "newFieldPerimeter"
        )
        .textContent =
        "—";


    document
        .getElementById(
            "newFieldCoordinates"
        )
        .textContent =
        "—";

}


function cancelFieldCreation() {

    closeCreateFieldModal();

}


/* =========================================================
   AREA
   ========================================================= */

function calculateArea(
    layer
) {

    const points =
        layer.getLatLngs()[0];


    let area = 0;


    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        const p1 =
            points[i];


        const p2 =
            points[
                (i + 1) %
                points.length
            ];


        area +=

            (
                p2.lng -
                p1.lng
            )

            *

            (
                2 +

                Math.sin(
                    p1.lat *
                    Math.PI /
                    180
                ) +

                Math.sin(
                    p2.lat *
                    Math.PI /
                    180
                )

            );

    }


    return (

        Math.abs(area) *
        6378137 *
        6378137 /
        2

    );

}


/* =========================================================
   PERIMETER
   ========================================================= */

function calculatePerimeter(
    layer
) {

    const points =
        layer.getLatLngs()[0];


    let distance = 0;


    for (
        let i = 0;
        i < points.length;
        i++
    ) {

        distance +=

            map.distance(

                points[i],

                points[
                    (i + 1) %
                    points.length
                ]

            );

    }


    return distance;

}


/* =========================================================
   CENTROID
   ========================================================= */

function getPolygonCentroid(
    layer
) {

    const points =
        layer.getLatLngs()[0];


    let lat = 0;

    let lng = 0;


    points.forEach(
        point => {

            lat += point.lat;

            lng += point.lng;

        }
    );


    return {

        lat:
            lat /
            points.length,

        lng:
            lng /
            points.length

    };

}


function getFieldCenter(
    field
) {

    if (
        field.centroid
    ) {

        return {

            lat:
                Number(
                    field.centroid.lat
                ),

            lng:
                Number(
                    field.centroid.lng
                )

        };

    }


    if (
        field.coordinates &&
        field.coordinates.length
    ) {

        let lat = 0;

        let lng = 0;


        field.coordinates.forEach(
            point => {

                lat +=
                    Number(
                        point[0]
                    );

                lng +=
                    Number(
                        point[1]
                    );

            }
        );


        return {

            lat:
                lat /
                field.coordinates.length,

            lng:
                lng /
                field.coordinates.length

        };

    }


    return null;

}


/* =========================================================
   AREA FORMATTING
   ========================================================= */

function formatArea(
    squareMeters
) {

    if (
        !squareMeters ||
        squareMeters <= 0
    ) {

        return "0 acres";

    }


    const acres =
        squareMeters *
        0.000247105;


    if (
        acres < 0.01
    ) {

        return (
            Math.round(squareMeters) +
            " m²"
        );

    }


    return (
        acres.toFixed(2) +
        " acres"
    );

}


function formatDistance(
    meters
) {

    if (
        meters < 1000
    ) {

        return (
            Math.round(meters) +
            " m"
        );

    }


    return (
        (meters / 1000).toFixed(2) +
        " km"
    );

}


function getFieldAreaText(
    field
) {

    if (
        field.area
    ) {

        return formatArea(
            field.area
        );

    }


    if (
        field.coordinates
    ) {

        return formatArea(

            calculateArea(

                L.polygon(
                    field.coordinates
                )

            )

        );

    }


    return "—";

}


/* =========================================================
   FARM STATS
   ========================================================= */

function updateFarmStats() {

    const fieldCount =
        document.getElementById(
            "fieldCount"
        );


    const farmArea =
        document.getElementById(
            "farmArea"
        );


    const health =
        document.getElementById(
            "farmHealth"
        );


    const status =
        document.getElementById(
            "farmHealthStatus"
        );


    const trend =
        document.getElementById(
            "healthTrend"
        );


    fieldCount.textContent =
        fields.length;


    const totalArea =
        fields.reduce(
            (sum, field) =>
                sum +
                (
                    Number(field.area) ||
                    0
                ),
            0
        );


    farmArea.textContent =
        formatArea(
            totalArea
        );


    if (
        !fields.length
    ) {

        health.textContent =
            "—";

        status.textContent =
            "No Fields";

        trend.textContent =
            "Create a field to begin";

        return;

    }


    const average =
        Math.round(

            fields.reduce(
                (sum, field) =>
                    sum +
                    Number(field.health || 0),
                0
            )

            /

            fields.length

        );


    health.textContent =
        average;


    if (
        average >= 80
    ) {

        status.textContent =
            "Healthy";

        status.style.color =
            "var(--green)";

    } else if (
        average >= 60
    ) {

        status.textContent =
            "Moderate";

        status.style.color =
            "var(--yellow)";

    } else {

        status.textContent =
            "High Risk";

        status.style.color =
            "var(--red)";

    }


    trend.textContent =
        `${fields.length} field${
            fields.length === 1 ? "" : "s"
        } monitored`;

}


/* =========================================================
   RISK PANEL
   ========================================================= */

function updateFarmRiskPanel() {

    if (
        !fields.length
    ) {

        document
            .getElementById(
                "alertTitle"
            )
            .textContent =
            "Monitoring farm";


        document
            .getElementById(
                "alertText"
            )
            .textContent =
            "Register a field to receive TerraMind intelligence.";


        document
            .getElementById(
                "mainRecommendation"
            )
            .textContent =
            "Register a field to receive TerraMind recommendations.";


        document
            .getElementById(
                "recommendationConfidence"
            )
            .textContent =
            "—";


        return;

    }


    const field =
        [...fields]
            .sort(
                (a, b) =>
                    a.health -
                    b.health
            )[0];


    document
        .getElementById(
            "alertTitle"
        )
        .textContent =
        `${field.name} requires attention`;


    document
        .getElementById(
            "alertText"
        )
        .textContent =
        field.recommendation;


    document
        .getElementById(
            "mainRecommendation"
        )
        .textContent =
        field.recommendation;


    document
        .getElementById(
            "recommendationConfidence"
        )
        .textContent =
        `${field.confidence || 0}%`;


    document
        .getElementById(
            "forecastNow"
        )
        .textContent =
        field.health;


    document
        .getElementById(
            "forecast24"
        )
        .textContent =
        Math.max(
            20,
            field.health - 5
        );


    document
        .getElementById(
            "forecast48"
        )
        .textContent =
        Math.max(
            15,
            field.health - 11
        );


    document
        .getElementById(
            "forecast72"
        )
        .textContent =
        Math.max(
            10,
            field.health - 18
        );


    document
        .getElementById(
            "forecastRisk"
        )
        .textContent =
        field.health < 70
            ? "HIGH RISK"
            : "MONITORING";

}


/* =========================================================
   OPEN RISK FIELD
   ========================================================= */

function openSelectedRiskField() {

    if (
        !fields.length
    ) {

        return;

    }


    const field =
        [...fields]
            .sort(
                (a, b) =>
                    a.health -
                    b.health
            )[0];


    selectField(
        field.id
    );

}


/* =========================================================
   DELETE
   ========================================================= */

function requestDeleteField() {

    if (
        !selectedField
    ) {

        return;

    }


    document
        .getElementById(
            "deleteFieldName"
        )
        .textContent =
        selectedField.name;


    document
        .getElementById(
            "deleteModal"
        )
        .classList
        .add(
            "show"
        );

}


function closeDeleteModal() {

    document
        .getElementById(
            "deleteModal"
        )
        .classList
        .remove(
            "show"
        );

}


function confirmDeleteField() {

    if (
        !selectedField
    ) {

        return;

    }


    fields =
        fields.filter(
            field =>
                field.id !==
                selectedField.id
        );


    selectedField =
        null;


    saveFields();

    closeDeleteModal();

    closeFieldModal();

    renderFields();

    renderDigitalTwin();

    updateFarmStats();

    updateFarmRiskPanel();

}


/* =========================================================
   FOCUS FIELD
   ========================================================= */

function focusSelectedField() {

    if (
        !selectedField ||
        !selectedField.coordinates
    ) {

        return;

    }


    const polygon =
        L.polygon(
            selectedField.coordinates
        );


    map.fitBounds(

        polygon.getBounds(),

        {
            padding: [80, 80],
            maxZoom: 18
        }

    );

}


/* =========================================================
   WEATHER
   ========================================================= */

async function loadWeather(
    latitude,
    longitude,
    locationName
) {

    const requestId =
        ++weatherRequestId;


    setWeatherLoading(
        locationName
    );


    try {

        const params =
            new URLSearchParams({

                latitude:
                    String(latitude),

                longitude:
                    String(longitude),

                current:
                    "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m",

                hourly:
                    "precipitation_probability",

                daily:
                    "precipitation_probability_max",

                forecast_days:
                    "3",

                timezone:
                    "auto"

            });


        const response =
            await fetch(

                `https://api.open-meteo.com/v1/forecast?${params.toString()}`

            );


        if (
            !response.ok
        ) {

            throw new Error(
                `Weather request failed: HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        if (
            requestId !==
            weatherRequestId
        ) {

            return;

        }


        if (
            !data.current
        ) {

            throw new Error(
                "Invalid weather response."
            );

        }


        const current =
            data.current;


        const rainProbability =
            getRainProbability(
                data
            );


        const environment =
            calculateEnvironment(

                Number(
                    current.temperature_2m
                ),

                Number(
                    current.relative_humidity_2m
                ),

                rainProbability,

                Number(
                    current.wind_speed_10m
                )

            );


        weatherContext = {

            temperature:
                Number(
                    current.temperature_2m
                ),

            humidity:
                Number(
                    current.relative_humidity_2m
                ),

            rainProbability,

            wind:
                Number(
                    current.wind_speed_10m
                ),

            environmentStress:
                environment.stress,

            diseasePressure:
                environment.diseasePressure,

            irrigationPressure:
                environment.irrigationPressure,

            risk:
                environment.risk,

            insight:
                environment.insight

        };


        document
            .getElementById(
                "weatherTemperature"
            )
            .textContent =
            `${Math.round(
                current.temperature_2m
            )}°`;


        document
            .getElementById(
                "weatherDescription"
            )
            .textContent =
            getWeatherDescription(
                current.weather_code
            );


        document
            .getElementById(
                "weatherLocation"
            )
            .textContent =
            locationName ||
            "Selected location";


        document
            .getElementById(
                "weatherHumidity"
            )
            .textContent =
            `${Math.round(
                current.relative_humidity_2m
            )}%`;


        document
            .getElementById(
                "weatherRain"
            )
            .textContent =
            `${rainProbability}%`;


        document
            .getElementById(
                "weatherWind"
            )
            .textContent =
            `${Math.round(
                current.wind_speed_10m
            )} km/h`;


        document
            .getElementById(
                "weatherUpdated"
            )
            .textContent =
            `Updated ${
                new Date().toLocaleTimeString(
                    [],
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                )
            }`;


        updateEnvironmentalUI();


        if (
            selectedField
        ) {

            updateFieldModal(
                selectedField
            );

        }

    } catch (error) {

        console.error(
            "Weather error:",
            error
        );


        setWeatherError(
            locationName
        );

    }

}


/* =========================================================
   WEATHER UI
   ========================================================= */

function setWeatherLoading(
    locationName
) {

    document
        .getElementById(
            "weatherTemperature"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherDescription"
        )
        .textContent =
        "Loading weather...";


    document
        .getElementById(
            "weatherLocation"
        )
        .textContent =
        locationName ||
        "Selected location";


    document
        .getElementById(
            "weatherHumidity"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherRain"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherWind"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherUpdated"
        )
        .textContent =
        "Fetching weather";

}


function setWeatherError(
    locationName
) {

    document
        .getElementById(
            "weatherTemperature"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherDescription"
        )
        .textContent =
        "Weather unavailable";


    document
        .getElementById(
            "weatherLocation"
        )
        .textContent =
        locationName ||
        "Selected location";


    document
        .getElementById(
            "weatherHumidity"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherRain"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherWind"
        )
        .textContent =
        "--";


    document
        .getElementById(
            "weatherUpdated"
        )
        .textContent =
        "Weather service unavailable";

}


/* =========================================================
   WEATHER INTELLIGENCE
   ========================================================= */

function calculateEnvironment(
    temperature,
    humidity,
    rainProbability,
    wind
) {

    let stress = 0;

    let diseasePressure = 0;

    let irrigationPressure = 0;


    if (
        temperature >= 38
    ) {

        stress += 35;

        irrigationPressure += 35;

    } else if (
        temperature >= 35
    ) {

        stress += 27;

        irrigationPressure += 27;

    } else if (
        temperature >= 32
    ) {

        stress += 16;

        irrigationPressure += 17;

    } else if (
        temperature >= 30
    ) {

        stress += 8;

        irrigationPressure += 8;

    }


    if (
        humidity >= 90
    ) {

        diseasePressure += 35;

        stress += 15;

    } else if (
        humidity >= 80
    ) {

        diseasePressure += 25;

        stress += 10;

    } else if (
        humidity >= 70
    ) {

        diseasePressure += 12;

        stress += 4;

    }


    if (
        rainProbability >= 80
    ) {

        diseasePressure += 20;

        irrigationPressure -= 20;

    } else if (
        rainProbability >= 60
    ) {

        diseasePressure += 12;

        irrigationPressure -= 12;

    } else if (
        rainProbability < 20
    ) {

        irrigationPressure += 18;

    }


    if (
        wind >= 30
    ) {

        stress += 10;

        irrigationPressure += 8;

    }


    stress =
        clamp(
            Math.round(stress),
            0,
            100
        );


    diseasePressure =
        clamp(
            Math.round(diseasePressure),
            0,
            100
        );


    irrigationPressure =
        clamp(
            Math.round(irrigationPressure),
            0,
            100
        );


    const maximum =
        Math.max(
            stress,
            diseasePressure,
            irrigationPressure
        );


    let risk = "LOW";

    let insight =
        "Environmental conditions are relatively stable.";


    if (
        maximum >= 60
    ) {

        risk = "HIGH";

    } else if (
        maximum >= 30
    ) {

        risk = "MODERATE";

    }


    if (
        diseasePressure >= 60
    ) {

        insight =
            "Warm, humid conditions are increasing disease pressure. Crop inspection is recommended.";

    } else if (
        irrigationPressure >= 60
    ) {

        insight =
            "Heat and low rainfall probability are increasing irrigation demand.";

    } else if (
        stress >= 60
    ) {

        insight =
            "Environmental conditions indicate elevated crop stress.";

    } else if (
        risk === "MODERATE"
    ) {

        insight =
            "Moderate environmental pressure detected. Continue active monitoring.";

    }


    return {

        stress,

        diseasePressure,

        irrigationPressure,

        risk,

        insight

    };

}


/* =========================================================
   ENVIRONMENT UI
   ========================================================= */

function updateEnvironmentalUI() {

    const pill =
        document.getElementById(
            "environmentRiskPill"
        );


    const stress =
        document.getElementById(
            "environmentStress"
        );


    const disease =
        document.getElementById(
            "environmentDiseasePressure"
        );


    const irrigation =
        document.getElementById(
            "environmentIrrigationPressure"
        );


    const insight =
        document.getElementById(
            "environmentInsight"
        );


    if (
        !weatherContext
    ) {

        pill.textContent =
            "—";


        stress.textContent =
            "—";


        disease.textContent =
            "—";


        irrigation.textContent =
            "—";


        insight.textContent =
            "Select or create a field to generate weather-driven intelligence.";


        return;

    }


    pill.textContent =
        weatherContext.risk;


    pill.className =
        `risk-pill ${
            weatherContext.risk === "HIGH"
                ? "high"
                : weatherContext.risk === "MODERATE"
                    ? "moderate"
                    : "low"
        }`;


    stress.textContent =
        `${weatherContext.environmentStress}/100`;


    disease.textContent =
        `${weatherContext.diseasePressure}/100`;


    irrigation.textContent =
        `${weatherContext.irrigationPressure}/100`;


    insight.textContent =
        weatherContext.insight;

}


function getEnvironmentStressText() {

    if (
        !weatherContext
    ) {

        return "—";

    }


    return (
        `${weatherContext.environmentStress}/100`
    );

}


/* =========================================================
   RAIN
   ========================================================= */

function getRainProbability(
    data
) {

    if (
        data.daily &&
        Array.isArray(
            data.daily
                .precipitation_probability_max
        ) &&
        data.daily
            .precipitation_probability_max
            .length
    ) {

        return Math.round(

            Number(
                data.daily
                    .precipitation_probability_max[0]
            ) || 0

        );

    }


    if (
        data.hourly &&
        Array.isArray(
            data.hourly
                .precipitation_probability
        )
    ) {

        return Math.round(

            Number(
                data.hourly
                    .precipitation_probability[0]
            ) || 0

        );

    }


    return 0;

}


/* =========================================================
   WEATHER DESCRIPTION
   ========================================================= */

function getWeatherDescription(
    code
) {

    const map = {

        0: "Clear sky",

        1: "Mainly clear",

        2: "Partly cloudy",

        3: "Overcast",

        45: "Fog",

        48: "Rime fog",

        51: "Light drizzle",

        53: "Drizzle",

        55: "Heavy drizzle",

        56: "Freezing drizzle",

        57: "Heavy freezing drizzle",

        61: "Light rain",

        63: "Moderate rain",

        65: "Heavy rain",

        66: "Freezing rain",

        67: "Heavy freezing rain",

        71: "Light snow",

        73: "Snow",

        75: "Heavy snow",

        77: "Snow grains",

        80: "Rain showers",

        81: "Moderate showers",

        82: "Heavy showers",

        85: "Snow showers",

        86: "Heavy snow showers",

        95: "Thunderstorm",

        96: "Thunderstorm + hail",

        99: "Severe thunderstorm"

    };


    return (
        map[code] ||
        "Unknown conditions"
    );

}


/* =========================================================
   LOCATION SEARCH
   ========================================================= */

async function searchLocation() {

    const input =
        document.getElementById(
            "locationSearch"
        );


    const query =
        input.value.trim();


    if (
        !query
    ) {

        return;

    }


    const status =
        document.getElementById(
            "searchStatus"
        );


    status.textContent =
        "Searching...";


    status.className =
        "search-status";


    try {

        const url =

            "https://nominatim.openstreetmap.org/search" +

            "?format=jsonv2" +

            "&limit=1" +

            "&countrycodes=pk" +

            "&q=" +

            encodeURIComponent(
                query
            );


        const response =
            await fetch(
                url
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `Location search failed: HTTP ${response.status}`
            );

        }


        const results =
            await response.json();


        if (
            !results.length
        ) {

            status.textContent =
                "Location not found.";


            status.classList.add(
                "error"
            );


            return;

        }


        const place =
            results[0];


        const lat =
            Number(
                place.lat
            );


        const lng =
            Number(
                place.lon
            );


        const name =
            getShortPlaceName(
                place
            );


        selectedLocation = {

            lat,

            lng,

            name

        };


        map.flyTo(

            [lat, lng],

            14,

            {
                duration: 1.2
            }

        );


        if (
            searchMarker
        ) {

            map.removeLayer(
                searchMarker
            );

        }


        searchMarker =
            L.marker(
                [lat, lng]
            )
            .addTo(
                map
            );


        searchMarker
            .bindPopup(
                `
                <strong>
                    Selected location
                </strong>

                <br>

                ${escapeHTML(
                    place.display_name
                )}
                `
            )
            .openPopup();


        updateLocationText(
            lat,
            lng,
            name
        );


        status.textContent =
            name;


        status.classList.add(
            "success"
        );


        await loadWeather(
            lat,
            lng,
            name
        );

    } catch (error) {

        console.error(
            "Search error:",
            error
        );


        status.textContent =
            error.message;


        status.classList.add(
            "error"
        );

    }

}


/* =========================================================
   SEARCH ENTER
   ========================================================= */

function handleSearchKey(
    event
) {

    if (
        event.key ===
        "Enter"
    ) {

        event.preventDefault();

        searchLocation();

    }

}


/* =========================================================
   CURRENT LOCATION
   ========================================================= */

function useCurrentLocation() {

    const button =
        document.getElementById(
            "locationButton"
        );


    const status =
        document.getElementById(
            "searchStatus"
        );


    if (
        !navigator.geolocation
    ) {

        status.textContent =
            "Geolocation is not supported by this browser.";

        status.className =
            "search-status error";

        return;

    }


    button.disabled =
        true;


    status.textContent =
        "Requesting current location...";


    status.className =
        "search-status";


    navigator.geolocation.getCurrentPosition(

        async position => {

            button.disabled =
                false;


            const lat =
                position.coords.latitude;


            const lng =
                position.coords.longitude;


            const accuracy =
                position.coords.accuracy;


            if (
                currentLocationMarker
            ) {

                map.removeLayer(
                    currentLocationMarker
                );

            }


            if (
                currentAccuracyCircle
            ) {

                map.removeLayer(
                    currentAccuracyCircle
                );

            }


            currentLocationMarker =
                L.circleMarker(

                    [lat, lng],

                    {
                        radius: 7,
                        color: "#ffffff",
                        weight: 2,
                        fillColor: "#8bd45c",
                        fillOpacity: 1
                    }

                )
                .addTo(
                    map
                );


            currentAccuracyCircle =
                L.circle(

                    [lat, lng],

                    {
                        radius: accuracy,
                        color: "#8bd45c",
                        weight: 1,
                        fillColor: "#8bd45c",
                        fillOpacity: 0.08
                    }

                )
                .addTo(
                    map
                );


            map.flyTo(
                [lat, lng],
                17,
                {
                    duration: 1.2
                }
            );


            selectedLocation = {

                lat,

                lng,

                name:
                    "Current location"

            };


            updateLocationText(
                lat,
                lng,
                "Current location"
            );


            status.textContent =
                `Current location ±${Math.round(
                    accuracy
                )}m`;


            status.className =
                "search-status success";


            await loadWeather(
                lat,
                lng,
                "Current location"
            );

        },

        error => {

            button.disabled =
                false;


            let message =
                "Unable to access current location.";


            if (
                error.code ===
                error.PERMISSION_DENIED
            ) {

                message =
                    "Location permission denied.";

            } else if (
                error.code ===
                error.POSITION_UNAVAILABLE
            ) {

                message =
                    "Current location unavailable.";

            } else if (
                error.code ===
                error.TIMEOUT
            ) {

                message =
                    "Location request timed out.";

            }


            status.textContent =
                message;


            status.className =
                "search-status error";


            console.error(
                "GPS error:",
                error
            );

        },

        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }

    );

}


/* =========================================================
   LOCATION UI
   ========================================================= */

function updateLocationText(
    lat,
    lng,
    name
) {

    document
        .getElementById(
            "farmLocation"
        )
        .textContent =
        name;


    document
        .getElementById(
            "mapCoordinates"
        )
        .textContent =
        `${lat.toFixed(3)}, ${lng.toFixed(3)}`;

}


/* =========================================================
   DISEASE FILE PICKER
   ========================================================= */

function openDiseaseFilePicker() {

    if (
        !selectedField
    ) {

        showDiseaseStatus(
            "Select a field first.",
            "error"
        );

        return;

    }


    document
        .getElementById(
            "diseaseImageInput"
        )
        .click();

}


/* =========================================================
   DISEASE ANALYSIS
   ========================================================= */

async function handleDiseaseImage(
    event
) {

    const file =
        event.target.files[0];


    if (
        !file
    ) {

        return;

    }


    if (
        !selectedField
    ) {

        showDiseaseStatus(
            "Select a field before analyzing an image.",
            "error"
        );

        return;

    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        showDiseaseStatus(
            "Please upload an image.",
            "error"
        );

        return;

    }


    const preview =
        document.getElementById(
            "diseasePreview"
        );


    const placeholder =
        document.getElementById(
            "diseasePlaceholder"
        );


    const title =
        document.getElementById(
            "diseaseResultTitle"
        );


    const confidence =
        document.getElementById(
            "diseaseResultConfidence"
        );


    const score =
        document.getElementById(
            "diseaseResultScore"
        );


    preview.src =
        URL.createObjectURL(
            file
        );


    preview.classList.remove(
        "hidden"
    );


    placeholder.style.display =
        "none";


    title.textContent =
        "Analyzing crop image...";


    confidence.textContent =
        "TerraMind Computer Vision";


    score.textContent =
        "…";


    showDiseaseStatus(
        "Running AI inference...",
        ""
    );


    try {

        const formData =
            new FormData();


        formData.append(
            "file",
            file
        );


        const response =
            await fetch(
                "/api/disease/predict",
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data.detail ||
                `AI server error: HTTP ${response.status}`
            );

        }


        applyDiseaseResult(
            selectedField,
            data
        );


        title.textContent =
            `${data.crop}: ${data.disease}`;


        confidence.textContent =
            `${data.confidence}% model confidence`;


        score.textContent =
            `${data.disease_risk}%`;


        showDiseaseStatus(

            data.healthy

                ? "AI vision indicates a healthy crop."

                : "Potential disease detected. Confirm before treatment.",

            "success"

        );


        saveFields();

        renderFields();

        renderDigitalTwin();

        updateFarmStats();

        updateFarmRiskPanel();

        updateFieldModal(
            selectedField
        );


    } catch (error) {

        console.error(
            "Disease analysis error:",
            error
        );


        title.textContent =
            "AI analysis failed";


        confidence.textContent =
            "See message below";


        score.textContent =
            "—";


        showDiseaseStatus(
            error.message,
            "error"
        );

    }

}


/* =========================================================
   DISEASE STATUS
   ========================================================= */

function showDiseaseStatus(
    message,
    type
) {

    const status =
        document.getElementById(
            "diseaseStatus"
        );


    status.textContent =
        message;


    status.className =
        "disease-status";


    if (
        type
    ) {

        status.classList.add(
            type
        );

    }

}


/* =========================================================
   APPLY AI RESULT
   ========================================================= */

function applyDiseaseResult(
    field,
    result
) {

    field.disease =
        result.disease;


    field.confidence =
        result.confidence;


    field.diseaseRisk =
        result.disease_risk;


    if (
        result.healthy
    ) {

        const envPenalty =
            weatherContext
                ? weatherContext.environmentStress *
                    0.12
                : 0;


        field.health =
            clamp(

                Math.round(
                    94 -
                    envPenalty
                ),

                70,

                100

            );


        field.recommendation =

            "TerraMind's computer vision model indicates a healthy crop image. " +

            "Continue monitoring environmental conditions and inspect again if symptoms appear.";

    } else {

        const diseasePenalty =
            result.disease_risk *
            0.38;


        const environmentPenalty =
            weatherContext
                ? weatherContext.environmentStress *
                    0.20
                : 0;


        field.health =
            clamp(

                Math.round(

                    100 -
                    diseasePenalty -
                    environmentPenalty

                ),

                25,

                100

            );


        field.recommendation =

            `Potential ${result.disease} detected with ` +

            `${result.confidence}% model confidence. ` +

            `Inspect affected plants and confirm the result ` +

            `before applying treatment.`;

    }


    saveFields();

}


/* =========================================================
   BACKEND HEALTH
   ========================================================= */

async function checkAIBackend() {

    try {

        const response =
            await fetch(
                "/health"
            );


        const data =
            await response.json();


        if (
            data.model_loaded
        ) {

            updateSystemStatus(
                "AI model ready"
            );

        } else {

            updateSystemStatus(
                "AI model unavailable"
            );

            console.error(
                "AI model error:",
                data.model_error
            );

        }


        return data;

    } catch (error) {

        updateSystemStatus(
            "AI server unavailable"
        );


        console.error(
            "Backend health error:",
            error
        );


        return null;

    }

}


/* =========================================================
   ASK AI
   ========================================================= */

function openAskAI() {

    document
        .getElementById(
            "askAIModal"
        )
        .classList
        .add(
            "show"
        );


    setTimeout(
        () => {

            document
                .getElementById(
                    "aiInput"
                )
                .focus();

        },
        100
    );

}


function closeAskAI() {

    document
        .getElementById(
            "askAIModal"
        )
        .classList
        .remove(
            "show"
        );

}


function handleAIKey(
    event
) {

    if (
        event.key ===
        "Enter"
    ) {

        event.preventDefault();

        sendAIMessage();

    }

}


function askSuggestion(
    question
) {

    document
        .getElementById(
            "aiInput"
        )
        .value =
        question;


    sendAIMessage();

}


function sendAIMessage() {

    const input =
        document.getElementById(
            "aiInput"
        );


    const question =
        input.value.trim();


    if (
        !question
    ) {

        return;

    }


    addAIMessage(
        question,
        "user"
    );


    input.value =
        "";


    setTimeout(
        () => {

            addAIMessage(
                generateAIResponse(
                    question
                ),
                "assistant"
            );

        },
        300
    );

}


function addAIMessage(
    text,
    type
) {

    const container =
        document.getElementById(
            "aiMessages"
        );


    const message =
        document.createElement(
            "div"
        );


    message.className =
        `ai-message ${type}`;


    message.innerHTML = `

        <div class="ai-avatar">
            ${
                type === "assistant"
                    ? "T"
                    : "U"
            }
        </div>

        <div class="ai-bubble">
            ${escapeHTML(text)}
        </div>

    `;


    container.appendChild(
        message
    );


    container.scrollTop =
        container.scrollHeight;

}


/* =========================================================
   COPILOT RESPONSE
   ========================================================= */

function generateAIResponse(
    question
) {

    const query =
        question.toLowerCase();


    if (
        query.includes("weather")
    ) {

        if (
            !weatherContext
        ) {

            return (
                "Weather data is not loaded yet."
            );

        }


        return (

            `Current conditions are ` +

            `${weatherContext.temperature}°C, ` +

            `${weatherContext.humidity}% humidity, ` +

            `${weatherContext.rainProbability}% rain probability, ` +

            `${Math.round(weatherContext.wind)} km/h wind. ` +

            `Environmental stress is ` +

            `${weatherContext.environmentStress}/100.`

        );

    }


    if (
        query.includes("disease")
    ) {

        if (
            !fields.length
        ) {

            return (
                "Create a field first."
            );

        }


        const field =
            [...fields]
                .sort(
                    (a, b) =>
                        b.diseaseRisk -
                        a.diseaseRisk
                )[0];


        return (

            `${field.name} currently has the highest ` +

            `disease risk at ${field.diseaseRisk}%. ` +

            `Latest finding: ${field.disease}.`

        );

    }


    if (
        query.includes("health")
    ) {

        if (
            !fields.length
        ) {

            return (
                "No fields are registered."
            );

        }


        const average =
            Math.round(

                fields.reduce(
                    (sum, field) =>
                        sum +
                        Number(field.health || 0),
                    0
                )
                /
                fields.length

            );


        return (

            `Average farm health is ${average}/100 ` +

            `across ${fields.length} field(s).`

        );

    }


    if (
        query.includes("attention") ||
        query.includes("risk") ||
        query.includes("field")
    ) {

        if (
            !fields.length
        ) {

            return (
                "No fields are registered yet."
            );

        }


        const field =
            [...fields]
                .sort(
                    (a, b) =>
                        a.health -
                        b.health
                )[0];


        return (

            `${field.name} needs the most attention. ` +

            `Its health score is ${field.health}/100. ` +

            `${field.recommendation}`

        );

    }


    if (
        query.includes("water") ||
        query.includes("irrigation")
    ) {

        if (
            !weatherContext
        ) {

            return (
                "Weather data is not loaded yet."
            );

        }


        return (

            `Current irrigation pressure is ` +

            `${weatherContext.irrigationPressure}/100. ` +

            (
                weatherContext.irrigationPressure >= 60

                    ? "Irrigation demand is elevated."

                    : "Irrigation demand is currently manageable."

            )

        );

    }


    return (

        "TerraMind is combining field geometry, weather " +

        "and crop-image intelligence. Ask me about weather, " +

        "disease, irrigation, health or field risk."

    );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showOverview() {

    document
        .getElementById(
            "overviewNav"
        )
        .classList
        .add(
            "active"
        );

}


function showFieldAnalytics() {

    if (
        selectedField
    ) {

        openFieldModal();

    } else {

        openAskAI();

    }

}


/* =========================================================
   ZOOM
   ========================================================= */

function zoomIn() {

    map.zoomIn();

}


function zoomOut() {

    map.zoomOut();

}


/* =========================================================
   HELPERS
   ========================================================= */

function clamp(
    value,
    min,
    max
) {

    return Math.min(
        max,
        Math.max(
            min,
            value
        )
    );

}


function getShortPlaceName(
    place
) {

    if (
        place &&
        place.address
    ) {

        return (

            place.address.city ||

            place.address.town ||

            place.address.village ||

            place.address.municipality ||

            place.address.county ||

            place.address.state ||

            "Selected location"

        );

    }


    return (
        place &&
        place.display_name
    )
    ||
    "Selected location";

}


function escapeHTML(
    value
) {

    return String(
        value
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* =========================================================
   ESCAPE
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Escape"
        ) {

            closeFieldModal();

            closeDeleteModal();

            closeCreateFieldModal();

            closeAskAI();

        }

    }
);