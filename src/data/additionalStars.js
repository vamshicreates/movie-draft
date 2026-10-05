// Curated released films in lead or substantial co-lead roles. Source pages:
// https://en.wikipedia.org/wiki/Chiranjeevi_filmography
// https://en.wikipedia.org/wiki/Nagarjuna_filmography
// https://en.wikipedia.org/wiki/Venkatesh_filmography
// https://en.wikipedia.org/wiki/Nandamuri_Balakrishna_filmography
// https://en.wikipedia.org/wiki/Pawan_Kalyan_filmography
// https://en.wikipedia.org/wiki/N._T._Rama_Rao_Jr._filmography
// For the remaining stars, see each actor's filmography on Wikipedia.
// No cameo, child, voice-only, special-song, producer-only, or unreleased credits.

import { posterPaths } from "./filmoPosterPaths.js";
import { textPoster } from "./filmographyExtras.js";

const heroes = [
  ["chiranjeevi", "Chiranjeevi", [
    ["Khaidi", 1983], ["Swayamkrushi", 1987], ["Rudraveena", 1988],
    ["Jagadeka Veerudu Athiloka Sundari", 1990], ["Gharana Mogudu", 1992],
    ["Indra", 2002], ["Tagore", 2003], ["Shankar Dada M.B.B.S.", 2004],
    ["Khaidi No. 150", 2017], ["Sye Raa Narasimha Reddy", 2019],
    ["Waltair Veerayya", 2023],
  ]],
  ["nagarjuna", "Nagarjuna", [
    ["Geetanjali", 1989], ["Siva", 1989], ["Ninne Pelladata", 1996],
    ["Annamayya", 1997], ["Manmadhudu", 2002], ["Sri Ramadasu", 2006],
    ["King", 2008], ["Soggade Chinni Nayana", 2016], ["Oopiri", 2016],
    ["Devadas", 2018], ["Bangarraju", 2022], ["Naa Saami Ranga", 2024],
  ]],
  ["venkatesh", "Venkatesh", [
    ["Swarna Kamalam", 1988], ["Kshana Kshanam", 1991], ["Chanti", 1992],
    ["Raja", 1999], ["Nuvvu Naaku Nachav", 2001], ["Malliswari", 2004],
    ["Seethamma Vakitlo Sirimalle Chettu", 2013], ["Drushyam", 2014],
    ["Guru", 2017], ["F2: Fun and Frustration", 2019], ["Narappa", 2021],
    ["Sankranthiki Vasthunam", 2025],
  ]],
  ["balakrishna", "Balakrishna", [
    ["Mangammagari Manavadu", 1984], ["Aditya 369", 1991],
    ["Bhairava Dweepam", 1994], ["Samarasimha Reddy", 1999],
    ["Narasimha Naidu", 2001], ["Simha", 2010], ["Legend", 2014],
    ["Gautamiputra Satakarni", 2017], ["Akhanda", 2021],
    ["Veera Simha Reddy", 2023], ["Bhagavanth Kesari", 2023],
    ["Daaku Maharaaj", 2025],
  ]],
  ["pawan-kalyan", "Pawan Kalyan", [
    ["Tholi Prema", 1998], ["Thammudu", 1999], ["Badri", 2000],
    ["Kushi", 2001], ["Jalsa", 2008], ["Gabbar Singh", 2012],
    ["Attarintiki Daredi", 2013], ["Gopala Gopala", 2015],
    ["Vakeel Saab", 2021], ["Bheemla Nayak", 2022],
    ["Hari Hara Veera Mallu", 2025], ["They Call Him OG", 2025],
  ]],
  ["jr-ntr", "Jr NTR", [
    ["Student No. 1", 2001], ["Aadi", 2002], ["Simhadri", 2003],
    ["Yamadonga", 2007], ["Adhurs", 2010], ["Brindavanam", 2010],
    ["Temper", 2015], ["Nannaku Prematho", 2016],
    ["Janatha Garage", 2016], ["Jai Lava Kusa", 2017],
    ["Aravinda Sametha Veera Raghava", 2018], ["RRR", 2022],
    ["Devara: Part 1", 2024],
  ]],
  ["ravi-teja", "Ravi Teja", [
    ["Itlu Sravani Subramanyam", 2001], ["Idiot", 2002],
    ["Amma Nanna O Tamila Ammayi", 2003], ["Venky", 2004],
    ["Bhadra", 2005], ["Vikramarkudu", 2006], ["Kick", 2009],
    ["Mirapakay", 2011], ["Raja The Great", 2017], ["Krack", 2021],
    ["Dhamaka", 2022], ["Tiger Nageswara Rao", 2023],
  ]],
  ["nithiin", "Nithiin", [
    ["Jayam", 2002], ["Dil", 2003], ["Sye", 2004], ["Ishq", 2012],
    ["Gunde Jaari Gallanthayyinde", 2013], ["Heart Attack", 2014],
    ["A Aa", 2016], ["Bheeshma", 2020], ["Rang De", 2021],
    ["Maestro", 2021], ["Robinhood", 2025],
  ]],
  ["varun-tej", "Varun Tej", [
    ["Mukunda", 2014], ["Kanche", 2015], ["Fidaa", 2017],
    ["Tholi Prema", 2018], ["Antariksham 9000 KMPH", 2018],
    ["F2: Fun and Frustration", 2019], ["Gaddalakonda Ganesh", 2019],
    ["F3", 2022], ["Operation Valentine", 2024], ["Matka", 2024],
  ]],
  ["sai-dharam-tej", "Sai Dharam Tej", [
    ["Pilla Nuvvu Leni Jeevitham", 2014], ["Subramanyam for Sale", 2015],
    ["Supreme", 2016], ["Jawaan", 2017], ["Chitralahari", 2019],
    ["Prati Roju Pandage", 2019], ["Solo Brathuke So Better", 2020],
    ["Republic", 2021], ["Virupaksha", 2023], ["Bro", 2023],
  ]],
  ["sharwanand", "Sharwanand", [
    ["Gamyam", 2008], ["Prasthanam", 2010], ["Run Raja Run", 2014],
    ["Malli Malli Idi Rani Roju", 2015], ["Express Raja", 2016],
    ["Sathamanam Bhavati", 2017], ["Mahanubhavudu", 2017],
    ["Jaanu", 2020], ["Oke Oka Jeevitham", 2022], ["Manamey", 2024],
  ]],
  ["sudheer-babu", "Sudheer Babu", [
    ["Shiva Manasulo Shruti", 2012], ["Prema Katha Chitram", 2013],
    ["Bhale Manchi Roju", 2015], ["Sammohanam", 2018],
    ["Nannu Dochukunduvate", 2018], ["V", 2020],
    ["Sridevi Soda Center", 2021], ["Aa Ammayi Gurinchi Meeku Cheppali", 2022],
    ["Harom Hara", 2024], ["Maa Nanna Superhero", 2024],
  ]],
  ["sree-vishnu", "Sree Vishnu", [
    ["Appatlo Okadundevaadu", 2016], ["Mental Madhilo", 2017],
    ["Needi Naadi Oke Katha", 2018], ["Brochevarevarura", 2019],
    ["Raja Raja Chora", 2021], ["Arjuna Phalguna", 2021],
    ["Samajavaragamana", 2023], ["Om Bheem Bush", 2024],
    ["Swag", 2024], ["Single", 2025],
  ]],
  ["adivi-sesh", "Adivi Sesh", [
    ["Karma", 2010], ["Kiss", 2013], ["Kshanam", 2016],
    ["Ami Thumi", 2017], ["Goodachari", 2018], ["Evaru", 2019],
    ["Major", 2022], ["HIT: The Second Case", 2022],
  ]],
  ["vishwak-sen", "Vishwak Sen", [
    ["Vellipomakey", 2017], ["Ee Nagaraniki Emaindhi", 2018],
    ["Falaknuma Das", 2019], ["HIT: The First Case", 2020],
    ["Ashoka Vanamlo Arjuna Kalyanam", 2022], ["Ori Devuda", 2022],
    ["Das Ka Dhamki", 2023], ["Gaami", 2024],
    ["Gangs of Godavari", 2024], ["Mechanic Rocky", 2024],
  ]],
  ["naveen-polishetty", "Naveen Polishetty", [
    ["Agent Sai Srinivasa Athreya", 2019],
    ["Jathi Ratnalu", 2021], ["Miss Shetty Mr Polishetty", 2023],
    ["Anaganaga Oka Raju", 2026],
  ]],
  ["siddhu-jonnalagadda", "Siddhu Jonnalagadda", [
    ["Life Before Wedding", 2011], ["Boy Meets Girl", 2014],
    ["Guntur Talkies", 2016], ["Krishna and His Leela", 2020],
    ["Maa Vintha Gaadha Vinuma", 2020], ["DJ Tillu", 2022],
    ["Tillu Square", 2024], ["Jack", 2025], ["Telusu Kada", 2025],
  ]],
  ["teja-sajja", "Teja Sajja", [
    ["Zombie Reddy", 2021], ["Ishq", 2021], ["Adbhutham", 2021],
    ["Hanu-Man", 2024], ["Mirai", 2025],
  ]],
];

const heroines = [
  ["rashmika-mandanna", "Rashmika Mandanna", [
    ["Kirik Party", 2016], ["Chalo", 2018], ["Geetha Govindam", 2018], ["Dear Comrade", 2019],
    ["Bheeshma", 2020], ["Pushpa: The Rise", 2021],
    ["Aadavallu Meeku Johaarlu", 2022],
    ["Animal", 2023], ["Pushpa 2: The Rule", 2024], ["The Girlfriend", 2025],
  ]],
  ["keerthy-suresh", "Keerthy Suresh", [
    ["Nenu Sailaja", 2016], ["Remo", 2016], ["Nenu Local", 2017],
    ["Mahanati", 2018], ["Sarkar", 2018], ["Rang De", 2021],
    ["Saani Kaayidham", 2022], ["Sarkaru Vaari Paata", 2022],
    ["Dasara", 2023], ["Raghu Thatha", 2024], ["Revolver Rita", 2025],
  ]],
  ["anushka-shetty", "Anushka Shetty", [
    ["Arundhati", 2009], ["Vedam", 2010], ["Singam", 2010],
    ["Mirchi", 2013],
    ["Rudhramadevi", 2015], ["Size Zero", 2015],
    ["Baahubali 2: The Conclusion", 2017], ["Bhaagamathie", 2018],
    ["Nishabdham", 2020], ["Miss Shetty Mr Polishetty", 2023],
    ["Ghaati", 2025],
  ]],
  ["nayanthara", "Nayanthara", [
    ["Chandramukhi", 2005], ["Billa", 2007], ["Raja Rani", 2013],
    ["Naanum Rowdy Dhaan", 2015], ["Aramm", 2017], ["Kolamaavu Kokila", 2018],
    ["Imaikkaa Nodigal", 2018], ["Mookuthi Amman", 2020],
    ["Netrikann", 2021], ["O2", 2022], ["Jawan", 2023],
    ["Annapoorani: The Goddess of Food", 2023],
  ]],
  ["tamannaah-bhatia", "Tamannaah Bhatia", [
    ["Happy Days", 2007], ["Ayan", 2009], ["Paiyaa", 2010],
    ["Racha", 2012], ["Baahubali: The Beginning", 2015],
    ["F2: Fun and Frustration", 2019], ["Sye Raa Narasimha Reddy", 2019],
    ["Babli Bouncer", 2022], ["Aranmanai 4", 2024], ["Odela 2", 2025],
  ]],
  ["kajal-aggarwal", "Kajal Aggarwal", [
    ["Chandamama", 2007], ["Magadheera", 2009], ["Darling", 2010],
    ["Brindavanam", 2010], ["Mr. Perfect", 2011], ["Thuppakki", 2012],
    ["Khaidi No. 150", 2017], ["Nene Raju Nene Mantri", 2017],
    ["Awe", 2018], ["Sita", 2019], ["Satyabhama", 2024],
  ]],
  ["trisha-krishnan", "Trisha Krishnan", [
    ["Varsham", 2004], ["Nuvvostanante Nenoddantana", 2005],
    ["Athadu", 2005], ["Vinnaithaandi Varuvaayaa", 2010],
    ["Kodi", 2016], ["'96", 2018], ["Raangi", 2022],
    ["Ponniyin Selvan: I", 2022], ["Ponniyin Selvan: II", 2023],
    ["Leo", 2023], ["The Road", 2023],
  ]],
  ["shruti-haasan", "Shruti Haasan", [
    ["Anaganaga O Dheerudu", 2011], ["Gabbar Singh", 2012],
    ["Balupu", 2013], ["Race Gurram", 2014], ["Srimanthudu", 2015],
    ["Premam", 2016], ["Krack", 2021], ["Veera Simha Reddy", 2023],
    ["Waltair Veerayya", 2023], ["Salaar: Part 1 – Ceasefire", 2023],
  ]],
  ["pooja-hegde", "Pooja Hegde", [
    ["Mukunda", 2014], ["DJ: Duvvada Jagannadham", 2017],
    ["Aravinda Sametha Veera Raghava", 2018], ["Maharshi", 2019],
    ["Gaddalakonda Ganesh", 2019], ["Ala Vaikunthapurramuloo", 2020],
    ["Most Eligible Bachelor", 2021], ["Radhe Shyam", 2022],
    ["Beast", 2022], ["Retro", 2025],
  ]],
  ["raashii-khanna", "Raashii Khanna", [
    ["Oohalu Gusagusalade", 2014], ["Bengal Tiger", 2015],
    ["Supreme", 2016], ["Jai Lava Kusa", 2017], ["Tholi Prema", 2018],
    ["Venky Mama", 2019], ["Prati Roju Pandage", 2019],
    ["Thiruchitrambalam", 2022], ["Sardar", 2022],
    ["Aranmanai 4", 2024], ["Telusu Kada", 2025],
  ]],
  ["nivetha-thomas", "Nivetha Thomas", [
    ["Papanasam", 2015], ["Gentleman", 2016], ["Ninnu Kori", 2017],
    ["Jai Lava Kusa", 2017], ["118", 2019], ["Brochevarevarura", 2019],
    ["V", 2020], ["Vakeel Saab", 2021], ["Saakini Daakini", 2022],
    ["35 Chinna Katha Kaadu", 2024],
  ]],
  ["regina-cassandra", "Regina Cassandra", [
    ["Routine Love Story", 2012], ["Pilla Nuvvu Leni Jeevitham", 2014],
    ["Subramanyam for Sale", 2015], ["Awe", 2018], ["Evaru", 2019],
    ["Nenjam Marappathillai", 2021], ["Saakini Daakini", 2022],
    ["Nene Naa", 2023], ["Conjuring Kannappan", 2023], ["Utsavam", 2024],
  ]],
  ["anupama-parameswaran", "Anupama Parameswaran", [
    ["Premam", 2015], ["A Aa", 2016], ["Sathamanam Bhavati", 2017],
    ["Vunnadhi Okate Zindagi", 2017], ["Hello Guru Prema Kosame", 2018],
    ["Karthikeya 2", 2022], ["18 Pages", 2022], ["Butterfly", 2022],
    ["Tillu Square", 2024], ["Paradha", 2025],
  ]],
  ["mrunal-thakur", "Mrunal Thakur", [
    ["Love Sonia", 2018], ["Toofaan", 2021],
    ["Jersey", 2022], ["Sita Ramam", 2022], ["Gumraah", 2023],
    ["Pippa", 2023], ["Hi Nanna", 2023], ["Aankh Micholi", 2023], ["The Family Star", 2024],
  ]],
  ["sreeleela", "Sreeleela", [
    ["Kiss", 2019], ["Pelli SandaD", 2021], ["Dhamaka", 2022],
    ["Skanda", 2023], ["Bhagavanth Kesari", 2023],
    ["Aadikeshava", 2023], ["Extra Ordinary Man", 2023],
    ["Guntur Kaaram", 2024], ["Robinhood", 2025],
  ]],
  ["meenakshi-chaudhary", "Meenakshi Chaudhary", [
    ["Ichata Vahanamulu Niluparadu", 2021], ["Khiladi", 2022],
    ["HIT: The Second Case", 2022], ["Kolai", 2023],
    ["Singapore Saloon", 2024], ["The Greatest of All Time", 2024],
    ["Lucky Baskhar", 2024], ["Matka", 2024],
    ["Mechanic Rocky", 2024], ["Sankranthiki Vasthunam", 2025],
  ]],
  ["faria-abdullah", "Faria Abdullah", [
    ["Jathi Ratnalu", 2021], ["Like, Share & Subscribe", 2022],
    ["Ravanasura", 2023], ["Aa Okkati Adakku", 2024],
    ["Mathu Vadalara 2", 2024], ["Gurram Paapi Reddy", 2025],
  ]],
  ["vaishnavi-chaitanya", "Vaishnavi Chaitanya", [
    ["Baby", 2023], ["Love Me", 2024], ["Jack", 2025],
  ]],
  ["janhvi-kapoor", "Janhvi Kapoor", [
    ["Dhadak", 2018], ["Gunjan Saxena: The Kargil Girl", 2020],
    ["Roohi", 2021], ["Good Luck Jerry", 2022], ["Mili", 2022],
    ["Bawaal", 2023], ["Mr. & Mrs. Mahi", 2024], ["Ulajh", 2024],
    ["Devara: Part 1", 2024], ["Param Sundari", 2025],
  ]],
];

function slug(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeMovie(starId, title, year) {
  const id = `${starId}-${slug(title)}`;
  return {
    id, title, shortTitle: title, year,
    poster: posterPaths[id] || textPoster(title, year),
    inVideoDraft: false, baseValue: 3,
  };
}

export function addAdditionalStars(stars) {
  for (const [category, entries] of [["Hero", heroes], ["Heroine", heroines]]) {
    for (const [id, name, films] of entries) {
      const movies = films.map(([title, year]) => makeMovie(id, title, year));
      stars.push({
        id, name, category, movies, featuredVideoStar: false,
        moniker: "", industry: "Indian Cinema", accentColor: category === "Hero" ? "#e50914" : "#ec4899",
        avatarPoster: movies[0].poster,
      });
    }
  }
}
