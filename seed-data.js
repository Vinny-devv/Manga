// ============================================================
// seed-data.js — Run this ONCE (as admin) to seed demo manga
// ============================================================
// HOW TO USE:
//   1. Sign in to V Scans as the admin (anwarbah96@gmail.com)
//   2. Open browser console on any page
//   3. Run: import('./seed-data.js').then(m => m.seedDemoData())
// ============================================================
import { addManga } from "./db.js";

const DEMO_MANGA = [
  {
    title: "Demon Slayer: Kimetsu no Yaiba",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/9/9e/Kimetsu_no_Yaiba_-_Manga_cover_1.jpg",
    genres: ["Action", "Fantasy", "Shounen"],
    description: "A young boy Tanjiro Kamado, who strives to become a demon slayer after his family is slaughtered and his younger sister Nezuko is turned into a demon."
  },
  {
    title: "Solo Leveling",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/b/b0/Solo_Leveling_Novel_Volume_1.jpg/220px-Solo_Leveling_Novel_Volume_1.jpg",
    genres: ["Action", "Fantasy", "Manhwa"],
    description: "In a world where hunters — humans with magical abilities — must battle deadly monsters to protect the rest of humanity, Sung Jinwoo, an E-rank hunter, is the weakest of them all."
  },
  {
    title: "One Piece",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/9/90/One_Piece%2C_Volume_61_Cover_%28Japanese%29.jpg",
    genres: ["Action", "Adventure", "Shounen"],
    description: "Monkey D. Luffy and his crew sail the Grand Line in search of the world's ultimate treasure known as 'One Piece' to become the next Pirate King."
  },
  {
    title: "Attack on Titan",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/AtkOnTitanV1.png/220px-AtkOnTitanV1.png",
    genres: ["Action", "Drama", "Dark Fantasy"],
    description: "In a world where humanity is forced to live within enormous walled cities to protect themselves from Titans, gigantic humanoid creatures, a young boy vows revenge after a Titan kills his mother."
  },
  {
    title: "Jujutsu Kaisen",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/8/88/Jujutsu_Kaisen_Vol_1.jpg/220px-Jujutsu_Kaisen_Vol_1.jpg",
    genres: ["Action", "Supernatural", "Shounen"],
    description: "A boy swallows a cursed talisman — the finger of a demon — and becomes cursed himself. He is entered into a school of exorcists to be able to locate the demon's other body parts and consume them all before being exorcised himself."
  },
  {
    title: "Naruto",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/9/94/NarutoCoverTankobon1.jpg/220px-NarutoCoverTankobon1.jpg",
    genres: ["Action", "Adventure", "Ninja"],
    description: "Naruto Uzumaki, a mischievous adolescent ninja, struggles as he searches for recognition and dreams of becoming the Hokage, the village's leader and strongest ninja."
  },
  {
    title: "Tower of God",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/2/25/Tower_of_God_manhwa_cover.jpg/220px-Tower_of_God_manhwa_cover.jpg",
    genres: ["Fantasy", "Adventure", "Manhwa"],
    description: "A boy named Twenty-Fifth Bam enters the Tower in pursuit of his closest friend, Rachel, and must face terrifying tests on each floor to climb higher."
  },
  {
    title: "Black Clover",
    coverUrl: "https://upload.wikimedia.org/wikipedia/en/thumb/7/7f/Black_Clover_volume_1.jpg/220px-Black_Clover_volume_1.jpg",
    genres: ["Action", "Magic", "Shounen"],
    description: "Asta and Yuno are two orphan boys raised together in the same church. Yuno proves to be a magical prodigy, while Asta is the only being born with absolutely no magical power."
  }
];

/**
 * Seeds demo manga into Firestore.
 * Call this once from the browser console as admin.
 */
export async function seedDemoData() {
  console.log("🌱 Seeding demo manga data…");
  let added = 0;
  for (const manga of DEMO_MANGA) {
    try {
      const id = await addManga(manga);
      console.log(`✅ Added: ${manga.title} (ID: ${id})`);
      added++;
    } catch (e) {
      console.error(`❌ Failed to add ${manga.title}:`, e);
    }
  }
  console.log(`🎉 Done! Added ${added}/${DEMO_MANGA.length} manga.`);
  return added;
}
