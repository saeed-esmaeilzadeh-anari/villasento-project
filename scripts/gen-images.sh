#!/bin/bash
# Generate demo villa images for Vilasa platform
mkdir -p /home/z/my-project/public/villas
cd /home/z/my-project/public/villas

gen() {
  z-ai image -p "$2" -o "./$1" -s 1344x768 && echo "OK $1" || echo "FAIL $1"
}

gen hero.jpg "Luxury Persian garden villa with turquoise swimming pool, cypress and orange trees, warm golden hour light, professional real estate photography, high quality, detailed" &
gen villa1.jpg "Modern luxury villa exterior with private swimming pool, wooden deck, evening lights, professional real estate photography, high quality" &
gen villa2.jpg "Traditional Persian garden villa with reflecting pool, pomegranate trees, brick architecture, daylight, professional photography, high quality" &
wait
gen villa3.jpg "Cozy eco lodge guesthouse in northern Iran green forest, wooden cottage with terrace, misty mountains, professional photography, high quality" &
gen villa4.jpg "Countryside stone cottage with large green garden, pergola with grape vines, BBQ area, sunny day, professional real estate photography, high quality" &
gen villa5.jpg "Luxury villa terrace with outdoor jacuzzi, string lights, sunset, mountain view, professional real estate photography, high quality" &
wait
gen villa6.jpg "Villa backyard lawn with BBQ pergola, outdoor dining table, garden flowers, bright daylight, professional photography, high quality" &
gen villa7.jpg "Duplex wooden villa among tall forest trees in north of Iran, balcony, fog, professional real estate photography, high quality" &
gen pool1.jpg "Beautiful swimming pool at dusk in luxury villa, warm underwater lights, palm shadows, professional photography, high quality" &
wait
gen int1.jpg "Cozy modern villa living room interior, warm colors, large windows to garden, professional interior photography, high quality" &
gen int2.jpg "Bright comfortable villa bedroom interior, white linens, garden view window, professional interior photography, high quality" &
gen suite1.jpg "Modern suite apartment terrace with city view at sunset, cozy seating, plants, professional real estate photography, high quality" &
wait
echo "ALL DONE"
