// ---------------------------------------------------------------- Galleria: fun facts and why each egg is here
// Shown on a found easter egg's card (48-gallery.js renderDetail), under its story: a few fun facts, and what
// inspired putting it in the game. Hidden until found, so nothing is spoiled. Every egg needs an entry
// (tests/test_web_data.py checks).
const EGG_FACTS = {
  sun: {
    fun: ['The Sun holds 99.8% of all the mass in the Solar System.',
          'Sunlight takes about 8 minutes 20 seconds to reach Earth, so you always see the Sun as it was a few minutes ago.',
          'About 1.3 million Earths would fit inside the Sun.'],
    why: 'Every map needs a "you are here". Kepler stared at one patch of sky for four years and never once looked back at home, so the Solar System had to be hidden somewhere on the map.',
  },
  pluto: {
    fun: ['Pluto has not finished a single orbit since it was found: a Plutonian year lasts 248 Earth years.',
          'It was named by Venetia Burney, an 11-year-old in Oxford, in 1930.',
          'Its moon Charon is half Pluto\'s width, so the two circle a point in the space between them.'],
    why: 'The most famous demotion in astronomy. Any space fan has an opinion on whether Pluto is a planet, and New Horizons finally showed us what it looks like.',
  },
  ceres: {
    fun: ['Ceres holds about a quarter of all the mass in the asteroid belt.',
          'Dawn was the first spacecraft to orbit two different worlds beyond Earth: Vesta, then Ceres.',
          'Ahuna Mons, a lone mountain about 4 km tall, is thought to be an ice volcano.'],
    why: 'The first asteroid ever found, and the only one that has been called a planet, an asteroid and a dwarf planet. A good riddle for a clue.',
  },
  haumea: {
    fun: ['A day on Haumea lasts just 3.9 hours, one of the fastest spins of any big object in the Solar System.',
          'Its surface is coated in crystalline water ice.',
          'A family of icy pieces shares its orbit: fragments of an ancient collision.'],
    why: 'The strangest shape of the five dwarf planets: an egg, which felt right for an easter egg.',
  },
  makemake: {
    fun: ['Makemake is one of the brightest objects in the Kuiper Belt, after Pluto.',
          'Its surface sits at about -240 °C.',
          'Its small dark moon had the nickname MK2 before it was studied.'],
    why: 'Found just after Easter 2005, so it is quite literally an Easter discovery. It completes the five dwarf planets for DWARF KING.',
  },
  eris: {
    fun: ['Eris takes about 557 years to go once round the Sun.',
          'It is one of the most reflective worlds known, as bright as fresh snow.',
          'Before it had an official name, its discoverers nicknamed it "Xena".'],
    why: 'The world that changed the definition of a planet. Without Eris, Pluto might still be the ninth planet.',
  },
  martian: {
    fun: ['Andy Weir first posted The Martian free on his website, one chapter at a time, before it became a book and a film.',
          'The dust storm that strands the hero could not really topple a rocket: Mars\'s air is too thin. Weir has said it was the one thing he changed on purpose.',
          'NASA scientists helped the 2015 film get the science right, working with the filmmakers as consultants.'],
    why: 'A nod to a story that made real Mars science popular: growing food is one of the hardest problems for a crew on Mars, and NASA really studies it.',
  },
  kepler: {
    fun: ['Kepler\'s camera had 42 light sensors and 95 megapixels, the biggest NASA had sent to space at the time.',
          'It found more than 2,600 confirmed planets, and many more candidates are still being checked.',
          'It is named after Johannes Kepler, who worked out the laws of planetary motion in the early 1600s.'],
    why: 'This whole map is Kepler\'s view of the sky. Every pixel is a star it watched, so the telescope itself had to be hidden in it.',
  },
  iss: {
    fun: ['The station travels at about 28,000 km/h and goes round the Earth every 90 minutes.',
          'It is about as long as a football field, 109 metres end to end.',
          'You can see it from your back yard: it looks like a bright, steady star gliding across the sky.'],
    why: 'The one place in space where people live, and the only Earth-orbit spacecraft in the game. You can go outside and find it for real.',
  },
  hailmary: {
    fun: ['Tau Ceti is one of the closest single Sun-like stars, so it has starred in science fiction for decades.',
          'In 1960 Frank Drake pointed a radio telescope at Tau Ceti in the first modern search for alien signals, Project Ozma.',
          'Its four planet candidates were found from the star\'s tiny back-and-forth wobble, not from transits like Kepler\'s.'],
    why: 'A nod to the story by the author of The Martian: in it, stars dim because something eats their light, and catching stars dimming is exactly how Kepler found its planets. The ship hides as a glint near Tau Ceti until you name it.',
  },
  hubble: {
    fun: ['Hubble is about the size of a school bus: 13.2 metres long.',
          'Its Deep Field picture of 1995 aimed at a dark speck of sky and found about 3,000 galaxies.',
          'It was the only telescope ever serviced by astronauts in orbit: five shuttle missions between 1993 and 2009.'],
    why: 'The most famous telescope ever built, and Kepler\'s elder cousin in space. Searching for it found nothing until a player asked, so here it is, beside the space station: the two Earth-orbit exceptions.',
  },
  voyager: {
    fun: ['Voyager 1\'s computers have about 70 kilobytes of memory, less than one photo on a phone.',
          'Its radio sends with about 22 watts, roughly a fridge light bulb, from more than 24 billion km away.',
          'The Golden Record has greetings in 55 languages, whale songs and music from Bach to Chuck Berry.'],
    why: 'The farthest thing humans have ever made, and the spacecraft that took the Pale Blue Dot. It had to be in a game about looking out into space.',
  },
  voyager2: {
    fun: ['Voyager 2 launched 16 days before Voyager 1; the numbers follow which one reached Jupiter first.',
          'The line-up of the outer planets it used happens only about once every 175 years.',
          'In 2023 a wrong command tipped its antenna 2 degrees away from Earth; engineers "shouted" a fix across 19 billion km and it worked.'],
    why: 'Still the only visitor Uranus and Neptune have ever had. It deserved its own card, separate from its twin.',
  },
  newHorizons: {
    fun: ['It passed the Moon\'s orbit about 9 hours after launch; Apollo crews took three days.',
          'It carries two US state quarters and some of the ashes of Clyde Tombaugh, who found Pluto.',
          'Sending home all its Pluto data took about 15 months, the radio link is that slow.'],
    why: 'It finished the story Pluto started: the first close look at the planet that was demoted the year New Horizons launched.',
  },
  jwst: {
    fun: ['Its mirror is coated in gold, but only about 48 grams of it, about the weight of a golf ball.',
          'Between the sunny side of its sunshield and the shaded side there is a difference of about 300 °C.',
          'It had to fold up like origami to fit inside its rocket, then unfold in space.'],
    why: 'Webb reads the air of exoplanets, many of them found by Kepler and TESS. It is the next chapter of the story this map tells.',
  },
  euclid: {
    fun: ['Its main camera has about 600 megapixels.',
          'It is named after Euclid of Alexandria, who wrote the most famous geometry book in history, around 300 BC.',
          'It measures how dark matter bends the light of billions of galaxies.'],
    why: 'It shares Sun-Earth L2 with Webb, so the two make a set (L2 NEIGHBOURS). It looks at the biggest picture of all: the shape of the universe.',
  },
  soho: {
    fun: ['In 1998 SOHO was lost for months and then found and saved by engineers, against the odds.',
          'It found its 5,000th comet in 2024.',
          'Most of those comets were spotted by volunteers looking at its pictures online.'],
    why: 'A spacecraft planned for two years that is still working after decades, and a comet hunter by accident. It fits a game about catching comets.',
  },
  parker: {
    fun: ['At its fastest it could fly from New York to Tokyo in under a minute.',
          'Its heat shield faces well over 1,000 °C while the instruments behind it stay near room temperature.',
          'It carries a memory card with the names of more than 1.1 million people.'],
    why: 'The spacecraft that "touched the Sun": the closest any human-made object has ever been to a star.',
  },
  solarOrbiter: {
    fun: ['Its first close pictures showed tiny flares all over the Sun, nicknamed "campfires".',
          'In 2025 it sent the first pictures ever taken of the Sun\'s poles.',
          'Its heat shield is coated with burnt bone charcoal, a coating used in ancient cave paintings.'],
    why: 'Together with Parker and SOHO it watches the star we live next to: the three make SUN CHASERS.',
  },
  bepi: {
    fun: ['Mercury is one of the hardest planets to reach: the Sun\'s pull speeds you up, so BepiColombo needs nine flybys to slow down.',
          'Even on Mercury, closest to the Sun, there is water ice in craters that never see sunlight.',
          'It is two orbiters in one, from Europe and Japan, travelling as a stack.'],
    why: 'The smallest planet gets the least attention, and BepiColombo is Europe\'s and Japan\'s way of fixing that.',
  },
  juno: {
    fun: ['Juno carries three LEGO figures made of aluminium: Galileo, the god Jupiter and the goddess Juno.',
          'Anyone can download its JunoCam pictures and process them; many of the famous Jupiter images were made by the public.',
          'When it reached Jupiter in 2016, Juno became the farthest solar-powered spacecraft ever.'],
    why: 'Jupiter is the planet giant exoplanets get compared with, and Juno shows what a giant planet is like up close.',
  },
  clipper: {
    fun: ['It carries a poem by US Poet Laureate Ada Limón, engraved on a metal plate, with 2.6 million names.',
          'Europa\'s hidden ocean may hold about twice as much water as all of Earth\'s oceans.',
          'It is the biggest spacecraft NASA has built for a planetary mission.'],
    why: 'One of the best places to look for life beyond Earth. Kepler asks "are there other worlds?"; Clipper asks "is anyone there?"',
  },
  juice: {
    fun: ['It will be the first spacecraft to orbit a moon other than our own: Ganymede.',
          'Ganymede is bigger than the planet Mercury.',
          'In 2024 it flew past the Moon and then the Earth in two days, a world first.'],
    why: 'Europe\'s mission to Jupiter\'s icy moons, part of JUPITER\'S ENTOURAGE.',
  },
  lucy: {
    fun: ['Lucy will visit more asteroids than any mission before it.',
          'In 2023 it found that its first asteroid, Dinkinesh, has a little moon, Selam.',
          'It carries a plaque with messages from Nobel laureates, poets and members of the Beatles.'],
    why: 'Named after a famous fossil because the Trojan asteroids are fossils too: leftovers from when the planets formed.',
  },
  psyche: {
    fun: ['In 2023 a laser on Psyche sent a video of a cat named Taters from 31 million km away, a test of space internet.',
          'Asteroid Psyche is about 220 km wide.',
          'It may be the exposed metal core of a planet that never finished forming.'],
    why: 'A trip to a world made of metal, something no one has ever seen up close.',
  },
  apex: {
    fun: ['It brought home 121.6 grams of asteroid Bennu, the biggest asteroid sample ever returned.',
          'Bennu\'s surface was so loose that the spacecraft would have sunk into it like a ball pit if it had not backed away.',
          'On 13 April 2029 asteroid Apophis will pass closer to Earth than some satellites, bright enough to see without a telescope.'],
    why: 'A spacecraft with two careers: first a sample return, now a close look at the asteroid people once feared might hit us.',
  },
  mro: {
    fun: ['Its HiRISE camera has caught avalanches tumbling down Martian cliffs as they happened.',
          'It has sent home more data than all other Mars missions combined.',
          'It photographed the Curiosity rover under its parachute as it landed.'],
    why: 'The workhorse in Mars orbit: rovers talk to Earth through it, which makes it part of the RED PLANET FLEET.',
  },
  odyssey: {
    fun: ['Arthur C. Clarke gave his blessing to the name, after "2001: A Space Odyssey".',
          'It found signs of lots of water ice just under the surface of Mars.',
          'It is the longest-working spacecraft at another planet.'],
    why: 'A nod to classic science fiction, and a mission that kept quietly working for decades.',
  },
  mex: {
    fun: ['Its radar found signs of liquid water under Mars\'s south polar ice in 2018.',
          'One of its cameras was turned into a "Mars webcam" that posts pictures online.',
          'Its lander Beagle 2 was lost in 2003 and found again in 2015, almost fully unfolded.'],
    why: 'Europe\'s first mission to another planet, with a lost-and-found story worth a clue.',
  },
  tgo: {
    fun: ['It carried the Schiaparelli lander, which crashed in 2016 because a sensor glitch told it it had already landed.',
          'It sniffs Mars\'s air for methane, a gas that living things can make, and found much less than expected.',
          'It relays messages from NASA\'s rovers to Earth.'],
    why: 'A mission about one question: is there something in Mars\'s air that hints at life?',
  },
  curiosity: {
    fun: ['It weighs about 900 kg, as much as a small car.',
          'On its first anniversary on Mars it played "Happy Birthday" to itself with its sample instrument.',
          'It has been driving for so long that its wheels are full of holes and dents.'],
    why: 'A car-sized lab exploring an ancient lake bed: proof that Mars was once a place where microbes could have lived. Search it to watch it at work.',
  },
  perseverance: {
    fun: ['Its parachute hid a secret code: "Dare mighty things" in its orange and white pattern.',
          'Its helicopter Ingenuity carried a tiny piece of fabric from the Wright brothers\' first airplane.',
          'It carries chips with the names of 10.9 million people.'],
    why: 'The rover collecting pieces of Mars to bring home one day, with the first aircraft on another planet as its sidekick. Search it to watch them work.',
  },
  zhurong: {
    fun: ['Zhurong weighs about 240 kg, a little more than Spirit and Opportunity.',
          'China reached Mars orbit, landed and drove a rover on its very first independent Mars mission, a first for any country.',
          'Its lander and rover were set down by a parachute, rockets and a hover phase, like NASA\'s, with a few minutes of "terror" all on autopilot.'],
    why: 'The first rover in the game from outside NASA: the story of driving on Mars belongs to more than one country, and Zhurong is the newest chapter.',
  },
  lunokhod: {
    fun: ['Lunokhod means "Moon walker" in Russian.',
          'It weighed about 756 kg, more than five times as much as Yutu-2.',
          'A ninth, thin wheel trailed behind it to measure how far it had really driven, since the others could slip in the dust.'],
    why: 'The very first rover on another world, 27 years before Sojourner: the story of rovers starts on the Moon.',
  },
  yutu2: {
    fun: ["Chang'e 4 carried a little sealed garden: cotton seeds sprouted inside it in January 2019, the first plants to sprout on the Moon.",
          'In 2019 Yutu-2 spotted something shiny in a small crater; it turned out to be glass melted by an impact.',
          'It weighs about 135 kg, about as much as a big motorbike.'],
    why: "No one had landed on the side of the Moon that always faces away from Earth until Chang'e 4; Yutu-2 is the rover that drove there.",
  },
  spirit: {
    fun: ['Spirit and Opportunity were named by Sofi Collis, a 9-year-old from Arizona, in a NASA essay contest.',
          'Its landing site was named Columbia Memorial Station, and the hills nearby after the seven astronauts of Space Shuttle Columbia.',
          'It was built to drive about 600 metres; it drove more than 7.7 km.'],
    why: 'The twin that never gave up: when a wheel broke it drove backwards, and the broken wheel itself found signs of hot springs. Sojourner, Spirit, Opportunity, Curiosity and Perseverance together tell the whole story of driving on Mars.',
  },
  opportunity: {
    fun: ['Its last data in 2018 was summed up by a reporter as "My battery is low and it\'s getting dark". The rover never sent those words, but the line made people around the world cry.',
          'It landed inside a crater only 22 metres wide, by pure luck: an "interplanetary hole in one".',
          'Wind gusts cleaned its solar panels again and again, which is why it kept going for so long.'],
    why: 'The record holder: built for 90 days, it lasted more than 14 years. A favourite of everyone who followed it, and Spirit\'s twin.',
  },
  sojourner: {
    fun: ['Sojourner\'s top speed was about 1 cm a second: crossing a tennis court would have taken it about 40 minutes.',
          'Pathfinder\'s pictures were among the most popular things on the early web: its website had hundreds of millions of hits in a month.',
          'The rover\'s name came from a 12-year-old\'s essay about Sojourner Truth, chosen from about 3,500 entries.'],
    why: 'Where every Mars rover began. In The Martian, the stranded astronaut drives out to dig up Pathfinder and uses it as his radio to Earth, so it now sits outside the Hab on the Martian farm too.',
  },
};

function eggFactsHtml(egg) {
  const f = EGG_FACTS[egg.id];
  if (!f) return '';
  return `<h3 class="facts-title">FUN FACTS</h3>
    <ul class="facts">${f.fun.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3 class="facts-title">WHY IT'S HERE</h3>
    <p>${esc(f.why)}</p>`;
}
