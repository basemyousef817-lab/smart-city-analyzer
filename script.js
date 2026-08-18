// ===================== المتغيرات العامة =====================
let map;
let routingControl = null;
let cityData = null;
let selectedCoords = null;
let autocompleteTimeout = null;
let markersLayer = null;

// ===================== شاشة الدخول =====================

function hideSplash() {
    document.getElementById('splashScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    initMap();
    loadData();
}

// ===================== تهيئة الخريطة =====================

function initMap() {
    map = L.map('map', {
        zoomControl: true,
        center: [30.0444, 31.2357],
        zoom: 12
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
        minZoom: 3
    }).addTo(map);
}

// ===================== تحميل البيانات =====================

async function loadData() {
    try {
        const response = await fetch('data.json');
        cityData = await response.json();
        console.log('✅ تم تحميل البيانات بنجاح');
        document.getElementById('cityInput').value = 'Cairo';
        setTimeout(() => analyzeCity(), 300);
    } catch (error) {
        console.error('❌ فشل تحميل البيانات:', error);
        alert('❌ فشل تحميل البيانات. تأكد من اتصال الإنترنت.');
    }
}

// ===================== البحث التلقائي =====================

document.getElementById('cityInput').addEventListener('input', function() {
    const query = this.value.trim();
    const resultsContainer = document.getElementById('autocompleteResults');

    if (query.length < 2) {
        resultsContainer.classList.remove('active');
        return;
    }

    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(async () => {
        try {
            const url =
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&accept-language=ar`;
            const response = await fetch(url);
            const data = await response.json();

            resultsContainer.innerHTML = '';
            if (data.length === 0) {
                resultsContainer.classList.remove('active');
                return;
            }

            data.forEach(place => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerHTML = `
                    <span class="place-name">${place.display_name.split(',')[0]}</span>
                    <span class="place-details">${place.display_name}</span>
                `;
                div.onclick = function() {
                    document.getElementById('cityInput').value = place.display_name;
                    resultsContainer.classList.remove('active');
                    selectedCoords = {
                        lat: parseFloat(place.lat),
                        lon: parseFloat(place.lon)
                    };
                    map.flyTo([selectedCoords.lat, selectedCoords.lon], 14);
                    analyzeCity();
                };
                resultsContainer.appendChild(div);
            });

            resultsContainer.classList.add('active');
        } catch (error) {
            console.error('خطأ في البحث:', error);
        }
    }, 300);
});

// ===================== تحليل المدينة =====================

async function analyzeCity() {
    const cityName = document.getElementById('cityInput').value.trim();
    if (!cityName) {
        alert('❌ من فضلك اكتب اسم مدينة');
        return;
    }

    document.getElementById('loading').style.display = 'block';

    try {
        if (!cityData) {
            await loadData();
        }

        let foundCity = null;
        let foundKey = null;

        for (const key in cityData) {
            if (cityName.toLowerCase().includes(key.toLowerCase()) ||
                key.toLowerCase().includes(cityName.toLowerCase())) {
                foundCity = cityData[key];
                foundKey = key;
                break;
            }
        }

        if (!foundCity) {
            foundCity = cityData.cairo;
            foundKey = 'cairo';
        }

        const analysis = {
            schools: foundCity.schools.map(p => ({ ...p, tags: { amenity: 'school' } })),
            hospitals: foundCity.hospitals.map(p => ({ ...p, tags: { amenity: 'hospital' } })),
            clinics: [],
            shops: foundCity.shops.map(p => ({ ...p, tags: { shop: 'yes' } })),
            mosques: foundCity.mosques.map(p => ({ ...p, tags: { amenity: 'place_of_worship' } }))
        };

        const coords = selectedCoords || getCityCoords(foundKey);
        displayResults(analysis, coords, cityName);
        generateRecommendations(analysis);

        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('خطأ:', error);
        alert('❌ حدث خطأ أثناء التحليل: ' + error.message);
        document.getElementById('loading').style.display = 'none';
    }
}

// ===================== إحداثيات المدن =====================

function getCityCoords(cityKey) {
    const coords = {
        'cairo': { lat: 30.0444, lon: 31.2357 },
        'alexandria': { lat: 31.2001, lon: 29.9187 },
        'menouf': { lat: 30.4667, lon: 30.9333 }
    };
    return coords[cityKey] || coords.cairo;
}

// ===================== عرض النتائج =====================

function displayResults(analysis, coords, cityName) {
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('cityName').textContent = `📊 تحليل مدينة: ${cityName}`;

    document.getElementById('schoolCount').textContent = analysis.schools.length;
    document.getElementById('hospitalCount').textContent = analysis.hospitals.length;
    document.getElementById('shopCount').textContent = analysis.shops.length;
    document.getElementById('mosqueCount').textContent = analysis.mosques.length;

    // عرض الجدول
    const detailsDiv = document.getElementById('detailsContent');
    let html = `<table>
        <thead>
            <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>النوع</th>
                <th>خط العرض</th>
                <th>خط الطول</th>
                <th>مسار</th>
            </tr>
        </thead>
        <tbody>`;

    const allPlaces = [
        ...analysis.schools.map(p => ({ ...p, type: 'مدرسة', icon: '🏫' })),
        ...analysis.hospitals.map(p => ({ ...p, type: 'مستشفى', icon: '🏥' })),
        ...analysis.shops.map(p => ({ ...p, type: 'محل', icon: '🛒' })),
        ...analysis.mosques.map(p => ({ ...p, type: 'مسجد', icon: '🕌' }))
    ];

    if (allPlaces.length === 0) {
        detailsDiv.innerHTML = '<p style="color:#888;padding:20px;text-align:center;">⚠️ لا توجد خدمات في هذه المنطقة</p>';
    } else {
        allPlaces.forEach((p, i) => {
            html += `<tr>
                <td>${i + 1}</td>
                <td><strong>${p.name}</strong></td>
                <td><span class="type-badge" style="background:${getColor(p.type)}">${p.icon} ${p.type}</span></td>
                <td>${p.lat.toFixed(5)}</td>
                <td>${p.lon.toFixed(5)}</td>
                <td><button onclick="getRoute(${p.lat}, ${p.lon}, '${p.name}')" class="btn-route">🗺️ مسار</button></td>
            </tr>`;
        });
        html += `</tbody></table>`;
        detailsDiv.innerHTML = html;
    }

    // تحديث الخريطة
    map.flyTo([coords.lat, coords.lon], 13);

    // إزالة العلامات القديمة
    if (markersLayer) {
        map.removeLayer(markersLayer);
    }
    markersLayer = L.layerGroup().addTo(map);

    // إضافة العلامات
    const markers = [
        { data: analysis.schools, color: '#4fc3f7', label: 'مدرسة', icon: '🏫' },
        { data: analysis.hospitals, color: '#ff6b6b', label: 'مستشفى', icon: '🏥' },
        { data: analysis.shops, color: '#ffd93d', label: 'محل', icon: '🛒' },
        { data: analysis.mosques, color: '#6bcb77', label: 'مسجد', icon: '🕌' }
    ];

    markers.forEach(group => {
        group.data.forEach(el => {
            const customIcon = L.divIcon({
                html: `<div style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${group.icon}</div>`,
                className: '',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            const marker = L.marker([el.lat, el.lon], { icon: customIcon }).addTo(markersLayer);
            marker.bindPopup(`
                <b>${el.name}</b><br>
                ${group.icon} النوع: ${group.label}<br>
                📍 ${el.lat.toFixed(5)}, ${el.lon.toFixed(5)}<br>
                <button onclick="getRoute(${el.lat}, ${el.lon}, '${el.name}')">🗺️ احصل على المسار</button>
            `);
        });
    });

    // وسيلة إيضاح
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.background = '#1a2332';
        div.style.padding = '12px 16px';
        div.style.borderRadius = '12px';
        div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        div.style.border = '1px solid rgba(79,195,247,0.1)';
        div.style.color = '#e0e0e0';
        div.innerHTML = `
            <h4 style="margin:0 0 8px;color:#4fc3f7;">🗺️ الخدمات</h4>
            <p style="margin:4px 0;"><span style="color:#4fc3f7;">●</span> مدارس 🏫</p>
            <p style="margin:4px 0;"><span style="color:#ff6b6b;">●</span> مستشفيات 🏥</p>
            <p style="margin:4px 0;"><span style="color:#ffd93d;">●</span> محلات 🛒</p>
            <p style="margin:4px 0;"><span style="color:#6bcb77;">●</span> مساجد 🕌</p>
        `;
        return div;
    };
    legend.addTo(map);
}

// ===================== تحديد المسار =====================

function getRoute(lat, lon, name) {
    if (!navigator.geolocation) {
        alert('❌ المتصفح لا يدعم تحديد الموقع');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            showRoute(userLat, userLon, lat, lon, name);
        },
        error => {
            alert('❌ فشل تحديد موقعك: ' + error.message + '\nسيتم استخدام القاهرة كبداية.');
            showRoute(30.0444, 31.2357, lat, lon, name);
        }
    );
}

function showRoute(startLat, startLon, endLat, endLon, name) {
    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(startLat, startLon),
            L.latLng(endLat, endLon)
        ],
        routeWhileDragging: true,
        showAlternatives: true,
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        language: 'ar',
        lineOptions: {
            styles: [{ color: '#4fc3f7', opacity: 1, weight: 5 }]
        }
    }).addTo(map);
}

// ===================== مسح المسار =====================

function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
        alert('🗑️ تم مسح المسار');
    } else {
        alert('ℹ️ لا يوجد مسار نشط');
    }
}

// ===================== دالة الألوان =====================

function getColor(type) {
    const colors = {
        'مدرسة': '#4fc3f7',
        'مستشفى': '#ff6b6b',
        'عيادة': '#f57c00',
        'محل': '#ffd93d',
        'مسجد': '#6bcb77'
    };
    return colors[type] || '#888';
}

// ===================== التوصيات =====================

function generateRecommendations(analysis) {
    const list = document.getElementById('recList');
    list.innerHTML = '';

    const totalSchools = analysis.schools.length;
    const totalHospitals = analysis.hospitals.length;
    const totalShops = analysis.shops.length;
    const totalMosques = analysis.mosques.length;

    const recs = [];

    if (totalSchools < 3) recs.push('🏫 نقترح إضافة مدرسة جديدة.');
    else if (totalSchools < 6) recs.push('📚 عدد المدارس جيد، ننصح بتحسين الجودة.');
    else recs.push('✅ المدارس كافية.');

    if (totalHospitals < 2) recs.push('🏥 نقترح إنشاء مستشفى.');
    else if (totalHospitals < 4) recs.push('🩺 الخدمات الصحية جيدة.');
    else recs.push('✅ الخدمات الصحية ممتازة.');

    if (totalShops < 5) recs.push('🛒 نقترح إنشاء مركز تجاري.');
    else if (totalShops < 10) recs.push('🛍️ المحلات جيدة.');
    else recs.push('✅ النشاط التجاري مزدهر.');

    if (totalMosques < 2) recs.push('🕌 نقترح إضافة مسجد.');
    else recs.push('✅ دور العبادة كافية.');

    recs.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        list.appendChild(li);
    });
}

// ===================== PDF =====================

function generatePDF() {
    if (!document.getElementById('resultsSection').style.display ||
        document.getElementById('resultsSection').style.display === 'none') {
        alert('❌ من فضلك قم بتحليل مدينة أولاً');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFontSize(20);
    doc.text('تقرير تحليل المدينة الذكية', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.text(`المدينة: ${document.getElementById('cityName').textContent}`, 20, 40);
    doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, 20, 50);

    doc.setFontSize(16);
    doc.text('الإحصائيات:', 20, 70);
    doc.setFontSize(12);
    doc.text(`🏫 المدارس: ${document.getElementById('schoolCount').textContent}`, 25, 85);
    doc.text(`🏥 المستشفيات: ${document.getElementById('hospitalCount').textContent}`, 25, 95);
    doc.text(`🛒 المحلات: ${document.getElementById('shopCount').textContent}`, 25, 105);
    doc.text(`🕌 المساجد: ${document.getElementById('mosqueCount').textContent}`, 25, 115);

    doc.setFontSize(16);
    doc.text('التوصيات:', 20, 135);
    let y = 150;
    doc.setFontSize(12);
    document.querySelectorAll('#recList li').forEach(li => {
        if (y > 270) { doc.addPage();
            y = 20; }
        doc.text(`• ${li.textContent}`, 25, y);
        y += 10;
    });

    doc.save('تقرير_تحليل_المدينة.pdf');
}

// ===================== موقع المستخدم =====================

function getMyLocation() {
    if (navigator.geolocation) {
        document.getElementById('loading').style.display = 'block';
        navigator.geolocation.getCurrentPosition(
            position => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                selectedCoords = { lat, lon };
                document.getElementById('cityInput').value = `${lat.toFixed(5)}, ${lon.toFixed(5)} (موقعي)`;
                map.flyTo([lat, lon], 14);
                document.getElementById('loading').style.display = 'none';
                analyzeCity();
            },
            error => {
                document.getElementById('loading').style.display = 'none';
                alert('❌ فشل تحديد الموقع: ' + error.message);
            }
        );
    } else {
        alert('❌ المتصفح لا يدعم تحديد الموقع');
    }
}