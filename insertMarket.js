import dotenv from 'dotenv'
dotenv.config()

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require'
})

async function insert() {
  try {

    const result = await sql`
      insert into market
      (object_id, owner_id, listing_type, price_to_rent_per_day, upvote, downvote, total)
      values
      (1, 1, 'rent', 2500, 0, 0, 0)
      returning *
    `

    console.log("✅ INSERTED:", result[0])

  } catch (err) {
    console.error("❌ ERROR:", err.message)
  } finally {
    process.exit()
  }
}

insert()
