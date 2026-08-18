// ===================== المتغيرات العامة =====================
let map;
let currentCoords = null;
let currentAnalysis = null;

// ===================== الدوال الرئيسية =====================

async function analyzeCity() {
    const cityName = document.getElementById('cityInput').value.trim();
    if (!cityName) {
        alert('❌ من فضلك اكتب اسم مدينة');
        return;
    }

    document.getElementById('loading').style.display = 'inline';

    try {
        // 1. جلب إحداثيات المدينة
        const coords = await getCityCoordinates(cityName);
        if (!coords) {
            alert('❌ المدينة غير موجودة. تأكد من كتابة الاسم بشكل صحيح.');
            document.getElementById('loading').style.display = 'none';
            return;
        }
        currentCoords = coords;

        // 2. جلب البيانات من Overpass API
        const data = await fetchCityData(coords.lat, coords.lon);

        // 3. تحليل البيانات
        const analysis = analyzeData(data);
        currentAnalysis = analysis;

        // 4. عرض النتائج
        displayResults(analysis, coords, cityName);

        // 5. عرض التوصيات
        generateRecommendations(analysis);

        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('خطأ:', error);
        alert('❌ حدث خطأ أثناء التحليل: ' + error.message + '\nتأكد من رفع التطبيق على GitHub Pages أو Vercel.');
        document.getElementById('loading').style.display = 'none';
    }
}

// ===================== جلب إحداثيات المدينة =====================

async function getCityCoordinates(cityName) {
    const url =
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.length === 0) return null;

    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name
    };
}

// ===================== جلب البيانات من Overpass =====================

async function fetchCityData(lat, lon) {
    const radius = 3000; // 3 كيلومتر

    const query = `[out:json][timeout:30];
    (
        node["amenity"="school"](around:${radius},${lat},${lon});
        node["amenity"="hospital"](around:${radius},${lat},${lon});
        node["amenity"="clinic"](around:${radius},${lat},${lon});
        node["amenity"="place_of_worship"](around:${radius},${lat},${lon});
        node["shop"](around:${radius},${lat},${lon});
        way["amenity"="school"](around:${radius},${lat},${lon});
        way["amenity"="hospital"](around:${radius},${lat},${lon});
        way["amenity"="clinic"](around:${radius},${lat},${lon});
        way["amenity"="place_of_worship"](around:${radius},${lat},${lon});
        way["shop"](around:${radius},${lat},${lon});
    );
    out center;`;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`فشل جلب البيانات (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (!data.elements || data.elements.length === 0) {
        throw new Error('لا توجد بيانات في هذه المنطقة');
    }

    return data;
}

// ===================== تحليل البيانات =====================

function analyzeData(data) {
    const analysis = {
        schools: [],
        hospitals: [],
        clinics: [],
        shops: [],
        mosques: []
    };

    data.elements.forEach(el => {
        if (!el.tags) return;

        const tags = el.tags;
        const amenity = tags.amenity || '';
        const shop = tags.shop || '';

        let lat = el.lat;
        let lon = el.lon;
        if (!lat && el.center) {
            lat = el.center.lat;
            lon = el.center.lon;
        }
        if (!lat) return;

        const name = tags.name || tags['name:ar'] || tags['name:en'] || 'بدون اسم';

        if (amenity === 'school') {
            analysis.schools.push({ lat, lon, name, tags });
        } else if (amenity === 'hospital') {
            analysis.hospitals.push({ lat, lon, name, tags });
        } else if (amenity === 'clinic') {
            analysis.clinics.push({ lat, lon, name, tags });
        } else if (amenity === 'place_of_worship') {
            analysis.mosques.push({ lat, lon, name, tags });
        } else if (shop) {
            analysis.shops.push({ lat, lon, name, tags });
        }
    });

    return analysis;
}

// ===================== عرض النتائج =====================

function displayResults(analysis, coords, cityName) {
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('cityName').textContent = `📊 تحليل مدينة: ${cityName}`;

    document.getElementById('schoolCount').textContent = analysis.schools.length;
    document.getElementById('hospitalCount').textContent = analysis.hospitals.length;
    document.getElementById('shopCount').textContent = analysis.shops.length;
    document.getElementById('mosqueCount').textContent = analysis.mosques.length;

    // ===== عرض الجدول =====
    const detailsDiv = document.getElementById('detailsContent');
    let html = `<table>
        <thead>
            <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>النوع</th>
                <th>خط العرض</th>
                <th>خط الطول</th>
            </tr>
        </thead>
        <tbody>`;

    const allPlaces = [
        ...analysis.schools.map(p => ({ ...p, type: 'مدرسة', icon: '🏫' })),
        ...analysis.hospitals.map(p => ({ ...p, type: 'مستشفى', icon: '🏥' })),
        ...analysis.clinics.map(p => ({ ...p, type: 'عيادة', icon: '🏥' })),
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
            </tr>`;
        });
        html += `</tbody></table>`;
        detailsDiv.innerHTML = html;
    }

    // ===== الخريطة =====
    if (map) map.remove();
    map = L.map('map').setView([coords.lat, coords.lon], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const markers = [
        { data: analysis.schools, color: '#1976d2', label: 'مدرسة', icon: '🏫' },
        { data: analysis.hospitals, color: '#d32f2f', label: 'مستشفى', icon: '🏥' },
        { data: analysis.clinics, color: '#f57c00', label: 'عيادة', icon: '🏥' },
        { data: analysis.shops, color: '#f9a825', label: 'محل', icon: '🛒' },
        { data: analysis.mosques, color: '#388e3c', label: 'مسجد', icon: '🕌' }
    ];

    markers.forEach(group => {
        group.data.forEach(el => {
            const marker = L.marker([el.lat, el.lon]).addTo(map);
            marker.bindPopup(`
                <b>${el.name}</b><br>
                ${group.icon} النوع: ${group.label}<br>
                📍 ${el.lat.toFixed(5)}, ${el.lon.toFixed(5)}
            `);
        });
    });

    // وسيلة إيضاح
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.background = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '8px';
        div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        div.innerHTML = `
            <h4>🗺️ أنواع الخدمات</h4>
            <p><span style="color:#1976d2;">●</span> مدارس 🏫</p>
            <p><span style="color:#d32f2f;">●</span> مستشفيات 🏥</p>
            <p><span style="color:#f57c00;">●</span> عيادات 🏥</p>
            <p><span style="color:#f9a825;">●</span> محلات 🛒</p>
            <p><span style="color:#388e3c;">●</span> مساجد 🕌</p>
        `;
        return div;
    };
    legend.addTo(map);

    setTimeout(() => map.invalidateSize(), 200);
}

function getColor(type) {
    const colors = {
        'مدرسة': '#1976d2',
        'مستشفى': '#d32f2f',
        'عيادة': '#f57c00',
        'محل': '#f9a825',
        'مسجد': '#388e3c'
    };
    return colors[type] || '#888';
}

// ===================== التوصيات =====================

function generateRecommendations(analysis) {
    const list = document.getElementById('recList');
    list.innerHTML = '';

    const totalSchools = analysis.schools.length;
    const totalHospitals = analysis.hospitals.length + analysis.clinics.length;
    const totalShops = analysis.shops.length;
    const totalMosques = analysis.mosques.length;

    const recs = [];

    if (totalSchools < 3) recs.push('🏫 نقترح إضافة مدرسة جديدة لتغطية الاحتياج التعليمي.');
    else if (totalSchools < 6) recs.push('📚 عدد المدارس جيد، ننصح بتحسين الجودة.');
    else recs.push('✅ المدارس كافية، ننصح بتطوير البنية التحتية.');

    if (totalHospitals < 2) recs.push('🏥 نقترح إنشاء مستشفى أو عيادة مركزية.');
    else if (totalHospitals < 4) recs.push('🩺 الخدمات الصحية جيدة، ننصح بإضافة تخصصات.');
    else recs.push('✅ الخدمات الصحية ممتازة.');

    if (totalShops < 5) recs.push('🛒 نقترح إنشاء مركز تجاري صغير.');
    else if (totalShops < 10) recs.push('🛍️ المحلات جيدة، ننصح بتنويع الأنشطة.');
    else recs.push('✅ النشاط التجاري مزدهر.');

    if (totalMosques < 2) recs.push('🕌 نقترح إضافة مسجد.');
    else recs.push('✅ دور العبادة كافية.');

    if (totalSchools === 0 && totalHospitals === 0 && totalShops === 0 && totalMosques === 0) {
        recs.push('⚠️ المنطقة فقيرة بالخدمات. نوصي بخطة عاجلة للتطوير.');
    }

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
        document.getElementById('loading').style.display = 'inline';
        navigator.geolocation.getCurrentPosition(
            position => {
                document.getElementById('cityInput').value =
                    `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
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

// ===================== تحميل أولي =====================

window.onload = function() {
    document.getElementById('cityInput').value = 'Nasr City, Cairo';
};