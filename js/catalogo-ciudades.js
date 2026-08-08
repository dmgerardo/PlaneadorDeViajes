// Catálogo estático de ciudades turísticas principales (~65 países más
// visitados del mundo) para autocompletar el formulario de "Agregar ciudad"
// (vista-ciudades.js). Formato compacto [nombre, país, zonaHoraria, lat, lng]
// para no repetir nombres de llave 300 veces; se expande abajo a objetos.
// Coordenadas son del centro aproximado de la ciudad — solo se usan para
// sombrear amanecer/atardecer en el calendario, no requieren precisión de
// GPS. Esto NO reemplaza la captura manual: es solo para prellenar más
// rápido, el catálogo puede no traer la ciudad que se busca.

const CATALOGO_CIUDADES_CRUDO = [
  // Francia
  ["París", "Francia", "Europe/Paris", 48.8566, 2.3522],
  ["Niza", "Francia", "Europe/Paris", 43.7102, 7.2620],
  ["Marsella", "Francia", "Europe/Paris", 43.2965, 5.3698],
  ["Lyon", "Francia", "Europe/Paris", 45.7640, 4.8357],
  ["Burdeos", "Francia", "Europe/Paris", 44.8378, -0.5792],
  ["Estrasburgo", "Francia", "Europe/Paris", 48.5734, 7.7521],
  // España
  ["Madrid", "España", "Europe/Madrid", 40.4168, -3.7038],
  ["Barcelona", "España", "Europe/Madrid", 41.3874, 2.1686],
  ["Sevilla", "España", "Europe/Madrid", 37.3891, -5.9845],
  ["Valencia", "España", "Europe/Madrid", 39.4699, -0.3763],
  ["Málaga", "España", "Europe/Madrid", 36.7213, -4.4214],
  ["Granada", "España", "Europe/Madrid", 37.1773, -3.5986],
  ["Bilbao", "España", "Europe/Madrid", 43.2630, -2.9350],
  // Estados Unidos
  ["Nueva York", "Estados Unidos", "America/New_York", 40.7128, -74.0060],
  ["Los Ángeles", "Estados Unidos", "America/Los_Angeles", 34.0522, -118.2437],
  ["Las Vegas", "Estados Unidos", "America/Los_Angeles", 36.1699, -115.1398],
  ["Miami", "Estados Unidos", "America/New_York", 25.7617, -80.1918],
  ["San Francisco", "Estados Unidos", "America/Los_Angeles", 37.7749, -122.4194],
  ["Chicago", "Estados Unidos", "America/Chicago", 41.8781, -87.6298],
  ["Orlando", "Estados Unidos", "America/New_York", 28.5383, -81.3792],
  ["Washington D.C.", "Estados Unidos", "America/New_York", 38.9072, -77.0369],
  ["Honolulu", "Estados Unidos", "Pacific/Honolulu", 21.3069, -157.8583],
  // China
  ["Pekín", "China", "Asia/Shanghai", 39.9042, 116.4074],
  ["Shanghái", "China", "Asia/Shanghai", 31.2304, 121.4737],
  ["Xi'an", "China", "Asia/Shanghai", 34.3416, 108.9398],
  ["Guilin", "China", "Asia/Shanghai", 25.2736, 110.2900],
  ["Chengdu", "China", "Asia/Shanghai", 30.5728, 104.0668],
  ["Hong Kong", "China", "Asia/Hong_Kong", 22.3193, 114.1694],
  ["Macao", "China", "Asia/Macau", 22.1987, 113.5439],
  // Italia
  ["Roma", "Italia", "Europe/Rome", 41.9028, 12.4964],
  ["Venecia", "Italia", "Europe/Rome", 45.4408, 12.3155],
  ["Florencia", "Italia", "Europe/Rome", 43.7696, 11.2558],
  ["Milán", "Italia", "Europe/Rome", 45.4642, 9.1900],
  ["Nápoles", "Italia", "Europe/Rome", 40.8518, 14.2681],
  ["Pisa", "Italia", "Europe/Rome", 43.7228, 10.4017],
  // Turquía
  ["Estambul", "Turquía", "Europe/Istanbul", 41.0082, 28.9784],
  ["Capadocia", "Turquía", "Europe/Istanbul", 38.6431, 34.8289],
  ["Antalya", "Turquía", "Europe/Istanbul", 36.8969, 30.7133],
  ["Ankara", "Turquía", "Europe/Istanbul", 39.9334, 32.8597],
  ["Bodrum", "Turquía", "Europe/Istanbul", 37.0343, 27.4305],
  // México
  ["Ciudad de México", "México", "America/Mexico_City", 19.4326, -99.1332],
  ["Cancún", "México", "America/Cancun", 21.1619, -86.8515],
  ["Playa del Carmen", "México", "America/Cancun", 20.6296, -87.0739],
  ["Tulum", "México", "America/Cancun", 20.2114, -87.4654],
  ["Puerto Vallarta", "México", "America/Mexico_City", 20.6534, -105.2253],
  ["Guadalajara", "México", "America/Mexico_City", 20.6597, -103.3496],
  ["Oaxaca", "México", "America/Mexico_City", 17.0732, -96.7266],
  ["San Miguel de Allende", "México", "America/Mexico_City", 20.9153, -100.7436],
  ["Los Cabos", "México", "America/Mazatlan", 22.8905, -109.9167],
  ["Mérida", "México", "America/Merida", 20.9674, -89.5926],
  // Tailandia
  ["Bangkok", "Tailandia", "Asia/Bangkok", 13.7563, 100.5018],
  ["Phuket", "Tailandia", "Asia/Bangkok", 7.8804, 98.3923],
  ["Chiang Mai", "Tailandia", "Asia/Bangkok", 18.7883, 98.9853],
  ["Krabi", "Tailandia", "Asia/Bangkok", 8.0863, 98.9063],
  ["Pattaya", "Tailandia", "Asia/Bangkok", 12.9236, 100.8825],
  ["Koh Samui", "Tailandia", "Asia/Bangkok", 9.5120, 100.0136],
  // Alemania
  ["Berlín", "Alemania", "Europe/Berlin", 52.5200, 13.4050],
  ["Múnich", "Alemania", "Europe/Berlin", 48.1351, 11.5820],
  ["Fráncfort", "Alemania", "Europe/Berlin", 50.1109, 8.6821],
  ["Hamburgo", "Alemania", "Europe/Berlin", 53.5511, 9.9937],
  ["Colonia", "Alemania", "Europe/Berlin", 50.9375, 6.9603],
  ["Dresde", "Alemania", "Europe/Berlin", 51.0504, 13.7373],
  // Reino Unido
  ["Londres", "Reino Unido", "Europe/London", 51.5072, -0.1276],
  ["Edimburgo", "Reino Unido", "Europe/London", 55.9533, -3.1883],
  ["Mánchester", "Reino Unido", "Europe/London", 53.4808, -2.2426],
  ["Liverpool", "Reino Unido", "Europe/London", 53.4084, -2.9916],
  ["Oxford", "Reino Unido", "Europe/London", 51.7520, -1.2577],
  ["Bath", "Reino Unido", "Europe/London", 51.3811, -2.3590],
  // Japón
  ["Tokio", "Japón", "Asia/Tokyo", 35.6762, 139.6503],
  ["Kioto", "Japón", "Asia/Tokyo", 35.0116, 135.7681],
  ["Osaka", "Japón", "Asia/Tokyo", 34.6937, 135.5023],
  ["Hiroshima", "Japón", "Asia/Tokyo", 34.3853, 132.4553],
  ["Nara", "Japón", "Asia/Tokyo", 34.6851, 135.8048],
  ["Sapporo", "Japón", "Asia/Tokyo", 43.0618, 141.3545],
  ["Fukuoka", "Japón", "Asia/Tokyo", 33.5904, 130.4017],
  // Austria
  ["Viena", "Austria", "Europe/Vienna", 48.2082, 16.3738],
  ["Salzburgo", "Austria", "Europe/Vienna", 47.8095, 13.0550],
  ["Innsbruck", "Austria", "Europe/Vienna", 47.2692, 11.4041],
  // Grecia
  ["Atenas", "Grecia", "Europe/Athens", 37.9838, 23.7275],
  ["Santorini", "Grecia", "Europe/Athens", 36.3932, 25.4615],
  ["Míkonos", "Grecia", "Europe/Athens", 37.4467, 25.3289],
  ["Creta (Heraclión)", "Grecia", "Europe/Athens", 35.3387, 25.1442],
  ["Rodas", "Grecia", "Europe/Athens", 36.4341, 28.2176],
  // Malasia
  ["Kuala Lumpur", "Malasia", "Asia/Kuala_Lumpur", 3.1390, 101.6869],
  ["Penang", "Malasia", "Asia/Kuala_Lumpur", 5.4141, 100.3288],
  ["Langkawi", "Malasia", "Asia/Kuala_Lumpur", 6.3500, 99.8000],
  ["Malaca", "Malasia", "Asia/Kuala_Lumpur", 2.1896, 102.2501],
  // Rusia
  ["Moscú", "Rusia", "Europe/Moscow", 55.7558, 37.6173],
  ["San Petersburgo", "Rusia", "Europe/Moscow", 59.9311, 30.3609],
  // Canadá
  ["Toronto", "Canadá", "America/Toronto", 43.6532, -79.3832],
  ["Vancouver", "Canadá", "America/Vancouver", 49.2827, -123.1207],
  ["Montreal", "Canadá", "America/Toronto", 45.5017, -73.5673],
  ["Quebec", "Canadá", "America/Toronto", 46.8139, -71.2080],
  ["Calgary", "Canadá", "America/Edmonton", 51.0447, -114.0719],
  ["Banff", "Canadá", "America/Edmonton", 51.1784, -115.5708],
  // Polonia
  ["Varsovia", "Polonia", "Europe/Warsaw", 52.2297, 21.0122],
  ["Cracovia", "Polonia", "Europe/Warsaw", 50.0647, 19.9450],
  ["Gdansk", "Polonia", "Europe/Warsaw", 54.3520, 18.6466],
  // Países Bajos
  ["Ámsterdam", "Países Bajos", "Europe/Amsterdam", 52.3676, 4.9041],
  ["Róterdam", "Países Bajos", "Europe/Amsterdam", 51.9244, 4.4777],
  ["La Haya", "Países Bajos", "Europe/Amsterdam", 52.0705, 4.3007],
  // Arabia Saudita
  ["Riad", "Arabia Saudita", "Asia/Riyadh", 24.7136, 46.6753],
  ["Yeda", "Arabia Saudita", "Asia/Riyadh", 21.4858, 39.1925],
  ["La Meca", "Arabia Saudita", "Asia/Riyadh", 21.3891, 39.8579],
  ["Medina", "Arabia Saudita", "Asia/Riyadh", 24.5247, 39.5692],
  ["AlUla", "Arabia Saudita", "Asia/Riyadh", 26.6089, 37.9214],
  // Portugal
  ["Lisboa", "Portugal", "Europe/Lisbon", 38.7223, -9.1393],
  ["Oporto", "Portugal", "Europe/Lisbon", 41.1579, -8.6291],
  ["Faro (Algarve)", "Portugal", "Europe/Lisbon", 37.0194, -7.9304],
  ["Sintra", "Portugal", "Europe/Lisbon", 38.8029, -9.3817],
  // Hungría
  ["Budapest", "Hungría", "Europe/Budapest", 47.4979, 19.0402],
  // Croacia
  ["Zagreb", "Croacia", "Europe/Zagreb", 45.8150, 15.9819],
  ["Dubrovnik", "Croacia", "Europe/Zagreb", 42.6507, 18.0944],
  ["Split", "Croacia", "Europe/Zagreb", 43.5081, 16.4402],
  ["Zadar", "Croacia", "Europe/Zagreb", 44.1194, 15.2314],
  // Egipto
  ["El Cairo", "Egipto", "Africa/Cairo", 30.0444, 31.2357],
  ["Luxor", "Egipto", "Africa/Cairo", 25.6872, 32.6396],
  ["Asuán", "Egipto", "Africa/Cairo", 24.0889, 32.8998],
  ["Sharm El Sheikh", "Egipto", "Africa/Cairo", 27.9158, 34.3300],
  ["Hurghada", "Egipto", "Africa/Cairo", 27.2579, 33.8116],
  ["Alejandría", "Egipto", "Africa/Cairo", 31.2001, 29.9187],
  // Emiratos Árabes Unidos
  ["Dubái", "Emiratos Árabes Unidos", "Asia/Dubai", 25.2048, 55.2708],
  ["Abu Dabi", "Emiratos Árabes Unidos", "Asia/Dubai", 24.4539, 54.3773],
  ["Sharjah", "Emiratos Árabes Unidos", "Asia/Dubai", 25.3463, 55.4209],
  // Marruecos
  ["Marrakech", "Marruecos", "Africa/Casablanca", 31.6295, -7.9811],
  ["Casablanca", "Marruecos", "Africa/Casablanca", 33.5731, -7.5898],
  ["Fez", "Marruecos", "Africa/Casablanca", 34.0181, -5.0078],
  ["Chefchaouen", "Marruecos", "Africa/Casablanca", 35.1688, -5.2636],
  ["Rabat", "Marruecos", "Africa/Casablanca", 34.0209, -6.8417],
  // Vietnam
  ["Hanói", "Vietnam", "Asia/Ho_Chi_Minh", 21.0278, 105.8342],
  ["Ciudad Ho Chi Minh", "Vietnam", "Asia/Ho_Chi_Minh", 10.8231, 106.6297],
  ["Da Nang", "Vietnam", "Asia/Ho_Chi_Minh", 16.0544, 108.2022],
  ["Hoi An", "Vietnam", "Asia/Ho_Chi_Minh", 15.8801, 108.3380],
  ["Ha Long", "Vietnam", "Asia/Ho_Chi_Minh", 20.9101, 107.1839],
  // Indonesia
  ["Bali (Denpasar)", "Indonesia", "Asia/Makassar", -8.3405, 115.0920],
  ["Yakarta", "Indonesia", "Asia/Jakarta", -6.2088, 106.8456],
  ["Yogyakarta", "Indonesia", "Asia/Jakarta", -7.7956, 110.3695],
  // Corea del Sur
  ["Seúl", "Corea del Sur", "Asia/Seoul", 37.5665, 126.9780],
  ["Busan", "Corea del Sur", "Asia/Seoul", 35.1796, 129.0756],
  ["Jeju", "Corea del Sur", "Asia/Seoul", 33.4996, 126.5312],
  // India
  ["Nueva Delhi", "India", "Asia/Kolkata", 28.6139, 77.2090],
  ["Bombay", "India", "Asia/Kolkata", 19.0760, 72.8777],
  ["Agra", "India", "Asia/Kolkata", 27.1767, 78.0081],
  ["Jaipur", "India", "Asia/Kolkata", 26.9124, 75.7873],
  ["Goa", "India", "Asia/Kolkata", 15.2993, 74.1240],
  ["Benarés", "India", "Asia/Kolkata", 25.3176, 82.9739],
  // Suiza
  ["Zúrich", "Suiza", "Europe/Zurich", 47.3769, 8.5417],
  ["Ginebra", "Suiza", "Europe/Zurich", 46.2044, 6.1432],
  ["Interlaken", "Suiza", "Europe/Zurich", 46.6863, 7.8632],
  ["Lucerna", "Suiza", "Europe/Zurich", 47.0502, 8.3093],
  ["Zermatt", "Suiza", "Europe/Zurich", 46.0207, 7.7491],
  // República Checa
  ["Praga", "República Checa", "Europe/Prague", 50.0755, 14.4378],
  ["Cesky Krumlov", "República Checa", "Europe/Prague", 48.8127, 14.3175],
  // Bélgica
  ["Bruselas", "Bélgica", "Europe/Brussels", 50.8503, 4.3517],
  ["Brujas", "Bélgica", "Europe/Brussels", 51.2093, 3.2247],
  ["Amberes", "Bélgica", "Europe/Brussels", 51.2194, 4.4025],
  // Irlanda
  ["Dublín", "Irlanda", "Europe/Dublin", 53.3498, -6.2603],
  ["Galway", "Irlanda", "Europe/Dublin", 53.2707, -9.0568],
  // Suecia
  ["Estocolmo", "Suecia", "Europe/Stockholm", 59.3293, 18.0686],
  ["Gotemburgo", "Suecia", "Europe/Stockholm", 57.7089, 11.9746],
  // Dinamarca
  ["Copenhague", "Dinamarca", "Europe/Copenhagen", 55.6761, 12.5683],
  // Noruega
  ["Oslo", "Noruega", "Europe/Oslo", 59.9139, 10.7522],
  ["Bergen", "Noruega", "Europe/Oslo", 60.3913, 5.3221],
  ["Tromsø", "Noruega", "Europe/Oslo", 69.6492, 18.9553],
  // Finlandia
  ["Helsinki", "Finlandia", "Europe/Helsinki", 60.1699, 24.9384],
  ["Rovaniemi", "Finlandia", "Europe/Helsinki", 66.5039, 25.7294],
  // Australia
  ["Sídney", "Australia", "Australia/Sydney", -33.8688, 151.2093],
  ["Melbourne", "Australia", "Australia/Melbourne", -37.8136, 144.9631],
  ["Brisbane", "Australia", "Australia/Brisbane", -27.4698, 153.0251],
  ["Perth", "Australia", "Australia/Perth", -31.9505, 115.8605],
  ["Cairns", "Australia", "Australia/Brisbane", -16.9186, 145.7781],
  ["Gold Coast", "Australia", "Australia/Brisbane", -28.0167, 153.4000],
  // Nueva Zelanda
  ["Auckland", "Nueva Zelanda", "Pacific/Auckland", -36.8485, 174.7633],
  ["Queenstown", "Nueva Zelanda", "Pacific/Auckland", -45.0312, 168.6626],
  ["Wellington", "Nueva Zelanda", "Pacific/Auckland", -41.2865, 174.7762],
  // Brasil
  ["Río de Janeiro", "Brasil", "America/Sao_Paulo", -22.9068, -43.1729],
  ["São Paulo", "Brasil", "America/Sao_Paulo", -23.5505, -46.6333],
  ["Salvador de Bahía", "Brasil", "America/Sao_Paulo", -12.9714, -38.5014],
  ["Foz do Iguaçu", "Brasil", "America/Sao_Paulo", -25.5478, -54.5882],
  ["Fortaleza", "Brasil", "America/Sao_Paulo", -3.7172, -38.5433],
  ["Manaos", "Brasil", "America/Manaus", -3.1190, -60.0217],
  // Argentina
  ["Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires", -34.6037, -58.3816],
  ["Bariloche", "Argentina", "America/Argentina/Buenos_Aires", -41.1335, -71.3103],
  ["Mendoza", "Argentina", "America/Argentina/Mendoza", -32.8895, -68.8458],
  ["El Calafate", "Argentina", "America/Argentina/Rio_Gallegos", -50.3379, -72.2648],
  // Perú
  ["Lima", "Perú", "America/Lima", -12.0464, -77.0428],
  ["Cusco", "Perú", "America/Lima", -13.5319, -71.9675],
  ["Machu Picchu", "Perú", "America/Lima", -13.1547, -72.5253],
  ["Arequipa", "Perú", "America/Lima", -16.4090, -71.5375],
  // Chile
  ["Santiago", "Chile", "America/Santiago", -33.4489, -70.6693],
  ["Valparaíso", "Chile", "America/Santiago", -33.0472, -71.6127],
  ["San Pedro de Atacama", "Chile", "America/Santiago", -22.9098, -68.1997],
  ["Puerto Natales", "Chile", "America/Santiago", -51.7236, -72.4875],
  // Colombia
  ["Bogotá", "Colombia", "America/Bogota", 4.7110, -74.0721],
  ["Cartagena", "Colombia", "America/Bogota", 10.3910, -75.4794],
  ["Medellín", "Colombia", "America/Bogota", 6.2442, -75.5812],
  ["San Andrés", "Colombia", "America/Bogota", 12.5847, -81.7006],
  // Cuba
  ["La Habana", "Cuba", "America/Havana", 23.1136, -82.3666],
  ["Varadero", "Cuba", "America/Havana", 23.1375, -81.2775],
  ["Trinidad", "Cuba", "America/Havana", 21.8040, -79.9848],
  // República Dominicana
  ["Punta Cana", "República Dominicana", "America/Santo_Domingo", 18.5601, -68.3725],
  ["Santo Domingo", "República Dominicana", "America/Santo_Domingo", 18.4861, -69.9312],
  ["Puerto Plata", "República Dominicana", "America/Santo_Domingo", 19.7934, -70.6884],
  // Costa Rica
  ["San José", "Costa Rica", "America/Costa_Rica", 9.9281, -84.0907],
  ["La Fortuna (Arenal)", "Costa Rica", "America/Costa_Rica", 10.4680, -84.6440],
  ["Manuel Antonio", "Costa Rica", "America/Costa_Rica", 9.3908, -84.1393],
  ["Tamarindo", "Costa Rica", "America/Costa_Rica", 10.2993, -85.8371],
  // Panamá
  ["Ciudad de Panamá", "Panamá", "America/Panama", 8.9824, -79.5199],
  ["Bocas del Toro", "Panamá", "America/Panama", 9.3400, -82.2400],
  // Guatemala
  ["Antigua Guatemala", "Guatemala", "America/Guatemala", 14.5586, -90.7295],
  ["Ciudad de Guatemala", "Guatemala", "America/Guatemala", 14.6349, -90.5069],
  ["Flores (Tikal)", "Guatemala", "America/Guatemala", 16.9276, -89.8907],
  // Sudáfrica
  ["Ciudad del Cabo", "Sudáfrica", "Africa/Johannesburg", -33.9249, 18.4241],
  ["Johannesburgo", "Sudáfrica", "Africa/Johannesburg", -26.2041, 28.0473],
  ["Durban", "Sudáfrica", "Africa/Johannesburg", -29.8587, 31.0218],
  ["Kruger (Mbombela)", "Sudáfrica", "Africa/Johannesburg", -25.4747, 30.9694],
  // Kenia
  ["Nairobi", "Kenia", "Africa/Nairobi", -1.2921, 36.8219],
  ["Mombasa", "Kenia", "Africa/Nairobi", -4.0435, 39.6682],
  ["Masái Mara", "Kenia", "Africa/Nairobi", -1.4061, 35.0058],
  // Tanzania
  ["Zanzíbar", "Tanzania", "Africa/Dar_es_Salaam", -6.1659, 39.2026],
  ["Arusha", "Tanzania", "Africa/Dar_es_Salaam", -3.3869, 36.6830],
  ["Dar es Salaam", "Tanzania", "Africa/Dar_es_Salaam", -6.7924, 39.2083],
  // Jordania
  ["Amán", "Jordania", "Asia/Amman", 31.9454, 35.9284],
  ["Petra", "Jordania", "Asia/Amman", 30.3285, 35.4444],
  ["Aqaba", "Jordania", "Asia/Amman", 29.5321, 35.0063],
  // Israel
  ["Jerusalén", "Israel", "Asia/Jerusalem", 31.7683, 35.2137],
  ["Tel Aviv", "Israel", "Asia/Jerusalem", 32.0853, 34.7818],
  // Catar
  ["Doha", "Catar", "Asia/Qatar", 25.2854, 51.5310],
  // Singapur
  ["Singapur", "Singapur", "Asia/Singapore", 1.3521, 103.8198],
  // Filipinas
  ["Manila", "Filipinas", "Asia/Manila", 14.5995, 120.9842],
  ["Cebú", "Filipinas", "Asia/Manila", 10.3157, 123.8854],
  ["Boracay", "Filipinas", "Asia/Manila", 11.9674, 121.9248],
  ["Palawan (Puerto Princesa)", "Filipinas", "Asia/Manila", 9.7392, 118.7353],
  // Camboya
  ["Siem Reap", "Camboya", "Asia/Phnom_Penh", 13.3633, 103.8564],
  ["Phnom Penh", "Camboya", "Asia/Phnom_Penh", 11.5564, 104.9282],
  // Laos
  ["Luang Prabang", "Laos", "Asia/Vientiane", 19.8845, 102.1348],
  ["Vientián", "Laos", "Asia/Vientiane", 17.9757, 102.6331],
  // Myanmar
  ["Bagan", "Myanmar", "Asia/Yangon", 21.1717, 94.8585],
  ["Yangón", "Myanmar", "Asia/Yangon", 16.8409, 96.1735],
  // Nepal
  ["Katmandú", "Nepal", "Asia/Kathmandu", 27.7172, 85.3240],
  ["Pokhara", "Nepal", "Asia/Kathmandu", 28.2096, 83.9856],
  // Sri Lanka
  ["Colombo", "Sri Lanka", "Asia/Colombo", 6.9271, 79.8612],
  ["Kandy", "Sri Lanka", "Asia/Colombo", 7.2906, 80.6337],
  ["Galle", "Sri Lanka", "Asia/Colombo", 6.0535, 80.2210],
  // Bután
  ["Timbu", "Bután", "Asia/Thimphu", 27.4712, 89.6339],
  ["Paro", "Bután", "Asia/Thimphu", 27.4287, 89.4164],
  // Taiwán
  ["Taipéi", "Taiwán", "Asia/Taipei", 25.0330, 121.5654],
  ["Kaohsiung", "Taiwán", "Asia/Taipei", 22.6273, 120.3014],
  // Islandia
  ["Reikiavik", "Islandia", "Atlantic/Reykjavik", 64.1466, -21.9426],
  // Eslovenia
  ["Liubliana", "Eslovenia", "Europe/Ljubljana", 46.0569, 14.5058],
  ["Bled", "Eslovenia", "Europe/Ljubljana", 46.3683, 14.1146],
  // Eslovaquia
  ["Bratislava", "Eslovaquia", "Europe/Bratislava", 48.1486, 17.1077],
  // Bulgaria
  ["Sofía", "Bulgaria", "Europe/Sofia", 42.6977, 23.3219],
  ["Plovdiv", "Bulgaria", "Europe/Sofia", 42.1354, 24.7453],
  // Rumania
  ["Bucarest", "Rumania", "Europe/Bucharest", 44.4268, 26.1025],
  ["Brasov", "Rumania", "Europe/Bucharest", 45.6427, 25.5887],
  // Serbia
  ["Belgrado", "Serbia", "Europe/Belgrade", 44.7866, 20.4489],
  // Bosnia y Herzegovina
  ["Sarajevo", "Bosnia y Herzegovina", "Europe/Sarajevo", 43.8563, 18.4131],
  ["Mostar", "Bosnia y Herzegovina", "Europe/Sarajevo", 43.3438, 17.8078],
  // Montenegro
  ["Kotor", "Montenegro", "Europe/Podgorica", 42.4247, 18.7712],
  ["Budva", "Montenegro", "Europe/Podgorica", 42.2911, 18.8400],
  // Albania
  ["Tirana", "Albania", "Europe/Tirane", 41.3275, 19.8187],
  // Chipre
  ["Nicosia", "Chipre", "Asia/Nicosia", 35.1856, 33.3823],
  ["Pafos", "Chipre", "Asia/Nicosia", 34.7720, 32.4297],
  // Malta
  ["La Valeta", "Malta", "Europe/Malta", 35.8989, 14.5146],
  // Luxemburgo
  ["Luxemburgo", "Luxemburgo", "Europe/Luxembourg", 49.6116, 6.1319],
  // Mónaco
  ["Montecarlo", "Mónaco", "Europe/Monaco", 43.7384, 7.4246],
  // Andorra
  ["Andorra la Vella", "Andorra", "Europe/Andorra", 42.5063, 1.5218],
  // Georgia
  ["Tiflis", "Georgia", "Asia/Tbilisi", 41.7151, 44.8271],
  ["Batumi", "Georgia", "Asia/Tbilisi", 41.6168, 41.6367],
  // Armenia
  ["Ereván", "Armenia", "Asia/Yerevan", 40.1792, 44.4991],
  // Azerbaiyán
  ["Bakú", "Azerbaiyán", "Asia/Baku", 40.4093, 49.8671],
  // Kazajistán
  ["Almaty", "Kazajistán", "Asia/Almaty", 43.2220, 76.8512],
  ["Astaná", "Kazajistán", "Asia/Almaty", 51.1694, 71.4491],
  // Uzbekistán
  ["Samarcanda", "Uzbekistán", "Asia/Tashkent", 39.6270, 66.9750],
  ["Taskent", "Uzbekistán", "Asia/Tashkent", 41.2995, 69.2401],
  ["Bujará", "Uzbekistán", "Asia/Tashkent", 39.7747, 64.4286],
  // Bolivia
  ["La Paz", "Bolivia", "America/La_Paz", -16.5000, -68.1500],
  ["Uyuni", "Bolivia", "America/La_Paz", -20.4600, -66.8250],
  // Uruguay
  ["Montevideo", "Uruguay", "America/Montevideo", -34.9011, -56.1645],
  ["Punta del Este", "Uruguay", "America/Montevideo", -34.9670, -54.9500],
  // Paraguay
  ["Asunción", "Paraguay", "America/Asuncion", -25.2637, -57.5759],
  // Venezuela
  ["Caracas", "Venezuela", "America/Caracas", 10.4806, -66.9036],
  ["Isla Margarita", "Venezuela", "America/Caracas", 10.9500, -63.8667],
  // Nicaragua
  ["Granada", "Nicaragua", "America/Managua", 11.9344, -85.9560],
  ["Managua", "Nicaragua", "America/Managua", 12.1150, -86.2362],
  // Honduras
  ["Roatán", "Honduras", "America/Tegucigalpa", 16.3249, -86.5397],
  ["Tegucigalpa", "Honduras", "America/Tegucigalpa", 14.0723, -87.1921],
  // El Salvador
  ["San Salvador", "El Salvador", "America/El_Salvador", 13.6929, -89.2182],
  // Belice
  ["San Pedro (Ambergris Caye)", "Belice", "America/Belize", 17.9333, -87.9667],
  // Jamaica
  ["Montego Bay", "Jamaica", "America/Jamaica", 18.4762, -77.8939],
  ["Kingston", "Jamaica", "America/Jamaica", 17.9714, -76.7931],
  // Bahamas
  ["Nassau", "Bahamas", "America/Nassau", 25.0343, -77.3963],
  // Barbados
  ["Bridgetown", "Barbados", "America/Barbados", 13.0969, -59.6145],
  // Trinidad y Tobago
  ["Puerto España", "Trinidad y Tobago", "America/Port_of_Spain", 10.6549, -61.5019],
  // Fiyi
  ["Nadi", "Fiyi", "Pacific/Fiji", -17.7765, 177.4356],
  ["Suva", "Fiyi", "Pacific/Fiji", -18.1416, 178.4419],
  // Túnez
  ["Túnez", "Túnez", "Africa/Tunis", 36.8065, 10.1815],
  ["Susa", "Túnez", "Africa/Tunis", 35.8256, 10.6369],
  // Etiopía
  ["Adís Abeba", "Etiopía", "Africa/Addis_Ababa", 9.0300, 38.7400],
  // Ruanda
  ["Kigali", "Ruanda", "Africa/Kigali", -1.9403, 29.8739],
  // Botsuana
  ["Gaborone", "Botsuana", "Africa/Gaborone", -24.6282, 25.9231],
  ["Delta del Okavango", "Botsuana", "Africa/Gaborone", -19.2833, 22.9833],
  // Namibia
  ["Windhoek", "Namibia", "Africa/Windhoek", -22.5609, 17.0658],
  // Zimbabue
  ["Cataratas Victoria", "Zimbabue", "Africa/Harare", -17.9243, 25.8567],
  ["Harare", "Zimbabue", "Africa/Harare", -17.8252, 31.0335],
  // Mauricio
  ["Port Louis", "Mauricio", "Indian/Mauritius", -20.1609, 57.5012],
  // Seychelles
  ["Mahé (Victoria)", "Seychelles", "Indian/Mahe", -4.6191, 55.4513],
  // Zambia
  ["Livingstone", "Zambia", "Africa/Lusaka", -17.8419, 25.8543],
  ["Lusaka", "Zambia", "Africa/Lusaka", -15.3875, 28.3228]
];

const CATALOGO_CIUDADES = CATALOGO_CIUDADES_CRUDO.map(([nombre, pais, zonaHoraria, lat, lng]) => ({
  nombre, pais, zonaHoraria, lat, lng
}));

// Quita acentos para que "cancun" encuentre "Cancún".
function normalizarBusqueda(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// Devuelve hasta `limite` ciudades cuyo nombre o país empiecen o contengan el texto buscado.
function buscarEnCatalogoCiudades(texto, limite = 8) {
  const consulta = normalizarBusqueda(texto);
  if (!consulta) return [];
  return CATALOGO_CIUDADES
    .filter(c => normalizarBusqueda(c.nombre).includes(consulta) || normalizarBusqueda(c.pais).includes(consulta))
    .slice(0, limite);
}

// Moneda oficial "de uso turístico" de cada país del catálogo — alimenta
// MONEDAS_SOPORTADAS/NOMBRE_MONEDA de abajo, que render-utils.js
// (opcionesMoneda/camposCosto) y vista-info.js (monedasActivasDe, tarjeta
// "Monedas del viaje") consumen para el selector de "Agregar moneda". No es
// un mapa de derecho estricto, es una elección práctica para viajeros: p.ej.
// Panamá queda en PAB (que cotiza 1:1 con USD), pero El Salvador y Zimbabue
// quedan en USD porque es la moneda que de verdad circula ahí.
const MONEDA_POR_PAIS = {
  "Francia": "EUR", "España": "EUR", "Estados Unidos": "USD", "China": "CNY",
  "Italia": "EUR", "Turquía": "TRY", "México": "MXN", "Tailandia": "THB",
  "Alemania": "EUR", "Reino Unido": "GBP", "Japón": "JPY", "Austria": "EUR",
  "Grecia": "EUR", "Malasia": "MYR", "Rusia": "RUB", "Canadá": "CAD",
  "Polonia": "PLN", "Países Bajos": "EUR", "Arabia Saudita": "SAR",
  "Portugal": "EUR", "Hungría": "HUF", "Croacia": "EUR", "Egipto": "EGP",
  "Emiratos Árabes Unidos": "AED", "Marruecos": "MAD", "Vietnam": "VND",
  "Indonesia": "IDR", "Corea del Sur": "KRW", "India": "INR", "Suiza": "CHF",
  "República Checa": "CZK", "Bélgica": "EUR", "Irlanda": "EUR", "Suecia": "SEK",
  "Dinamarca": "DKK", "Noruega": "NOK", "Finlandia": "EUR", "Australia": "AUD",
  "Nueva Zelanda": "NZD", "Brasil": "BRL", "Argentina": "ARS", "Perú": "PEN",
  "Chile": "CLP", "Colombia": "COP", "Cuba": "CUP", "República Dominicana": "DOP",
  "Costa Rica": "CRC", "Panamá": "PAB", "Guatemala": "GTQ", "Sudáfrica": "ZAR",
  "Kenia": "KES", "Tanzania": "TZS", "Jordania": "JOD", "Israel": "ILS",
  "Catar": "QAR", "Singapur": "SGD", "Filipinas": "PHP", "Camboya": "KHR",
  "Laos": "LAK", "Myanmar": "MMK", "Nepal": "NPR", "Sri Lanka": "LKR",
  "Bután": "BTN", "Taiwán": "TWD", "Islandia": "ISK", "Eslovenia": "EUR",
  "Eslovaquia": "EUR", "Bulgaria": "BGN", "Rumania": "RON", "Serbia": "RSD",
  "Bosnia y Herzegovina": "BAM", "Montenegro": "EUR", "Albania": "ALL",
  "Chipre": "EUR", "Malta": "EUR", "Luxemburgo": "EUR", "Mónaco": "EUR",
  "Andorra": "EUR", "Georgia": "GEL", "Armenia": "AMD", "Azerbaiyán": "AZN",
  "Kazajistán": "KZT", "Uzbekistán": "UZS", "Bolivia": "BOB", "Uruguay": "UYU",
  "Paraguay": "PYG", "Venezuela": "VES", "Nicaragua": "NIO", "Honduras": "HNL",
  "El Salvador": "USD", "Belice": "BZD", "Jamaica": "JMD", "Bahamas": "BSD",
  "Barbados": "BBD", "Trinidad y Tobago": "TTD", "Fiyi": "FJD", "Túnez": "TND",
  "Etiopía": "ETB", "Ruanda": "RWF", "Botsuana": "BWP", "Namibia": "NAD",
  "Zimbabue": "USD", "Mauricio": "MUR", "Seychelles": "SCR", "Zambia": "ZMW"
};

// Nombre legible de cada código, para el selector de "Agregar moneda".
const NOMBRE_MONEDA = {
  EUR: "Euro", USD: "Dólar estadounidense", CNY: "Yuan chino", TRY: "Lira turca",
  MXN: "Peso mexicano", THB: "Baht tailandés", GBP: "Libra esterlina", JPY: "Yen japonés",
  MYR: "Ringgit malasio", RUB: "Rublo ruso", CAD: "Dólar canadiense", PLN: "Zloty polaco",
  SAR: "Riyal saudí", HUF: "Forinto húngaro", EGP: "Libra egipcia", AED: "Dirham de EAU",
  MAD: "Dirham marroquí", VND: "Dong vietnamita", IDR: "Rupia indonesia", KRW: "Won surcoreano",
  INR: "Rupia india", CHF: "Franco suizo", CZK: "Corona checa", SEK: "Corona sueca",
  DKK: "Corona danesa", NOK: "Corona noruega", AUD: "Dólar australiano", NZD: "Dólar neozelandés",
  BRL: "Real brasileño", ARS: "Peso argentino", PEN: "Sol peruano", CLP: "Peso chileno",
  COP: "Peso colombiano", CUP: "Peso cubano", DOP: "Peso dominicano", CRC: "Colón costarricense",
  PAB: "Balboa panameño", GTQ: "Quetzal guatemalteco", ZAR: "Rand sudafricano", KES: "Chelín keniano",
  TZS: "Chelín tanzano", JOD: "Dinar jordano", ILS: "Séquel israelí", QAR: "Riyal catarí",
  SGD: "Dólar de Singapur", PHP: "Peso filipino", KHR: "Riel camboyano", LAK: "Kip laosiano",
  MMK: "Kyat birmano", NPR: "Rupia nepalí", LKR: "Rupia de Sri Lanka", BTN: "Ngultrum butanés",
  TWD: "Dólar taiwanés", ISK: "Corona islandesa", BGN: "Lev búlgaro", RON: "Leu rumano",
  RSD: "Dinar serbio", BAM: "Marco convertible bosnio", ALL: "Lek albanés", GEL: "Lari georgiano",
  AMD: "Dram armenio", AZN: "Manat azerbaiyano", KZT: "Tenge kazajo", UZS: "Som uzbeko",
  BOB: "Boliviano", UYU: "Peso uruguayo", PYG: "Guaraní paraguayo", VES: "Bolívar venezolano",
  NIO: "Córdoba nicaragüense", HNL: "Lempira hondureño", BZD: "Dólar beliceño", JMD: "Dólar jamaicano",
  BSD: "Dólar bahameño", BBD: "Dólar de Barbados", TTD: "Dólar de Trinidad y Tobago", FJD: "Dólar fiyiano",
  TND: "Dinar tunecino", ETB: "Birr etíope", RWF: "Franco ruandés", BWP: "Pula botsuanesa",
  NAD: "Dólar namibio", MUR: "Rupia mauriciana", SCR: "Rupia de Seychelles", ZMW: "Kwacha zambiano"
};

// Monedas ofrecidas al agregar una a un viaje (vista-info.js) — la unión de
// las monedas de todos los países del catálogo, sin repetidos. Si el
// catálogo crece con un país nuevo, agrégalo también a MONEDA_POR_PAIS de
// arriba o su moneda no aparecerá aquí.
const MONEDAS_SOPORTADAS = Array.from(new Set(Object.values(MONEDA_POR_PAIS))).sort();
