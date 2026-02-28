import dotenv from 'dotenv'
dotenv.config({ path: './.env' })

import express from 'express'
import postgres from 'postgres'

const app = express()
app.use(express.json())

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  connect_timeout: 30
})

app.get('/', (req, res) => res.send('Server running 🚀'))

/* =====================================================
   PERSON
===================================================== */

app.post('/person', async (req, res) => {
  try {
    const { id, name } = req.body
    const result = await sql`
      insert into person (id, name)
      values (${id}, ${name})
      returning *
    `
    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/person', async (req, res) => {
  res.json(await sql`select * from person order by id`)
})

/* =====================================================
   OBJECT
===================================================== */

app.post('/object', async (req, res) => {
  try {
    const { name, description } = req.body
    const result = await sql`
      insert into object (name, description)
      values (${name}, ${description})
      returning *
    `
    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/object', async (req, res) => {
  res.json(await sql`select * from object order by object_id desc`)
})

/* =====================================================
   MARKET
===================================================== */

app.post('/market', async (req, res) => {
  try {
    const {
      object_id, owner_id, listing_type,
      price_to_buy, price_to_rent_per_day
    } = req.body

    const result = await sql`
      insert into market
      (object_id, owner_id, listing_type, price_to_buy, price_to_rent_per_day, upvote, downvote, total)
      values (
        ${object_id}, ${owner_id}, ${listing_type},
        ${price_to_buy ?? null},
        ${price_to_rent_per_day ?? null},
        0,0,0
      )
      returning *
    `
    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/market-details', async (req, res) => {
  res.json(await sql`
    select market.market_id, object.name as object_name,
    person.name as owner_name, listing_type,
    price_to_buy, price_to_rent_per_day
    from market
    join object on market.object_id = object.object_id
    join person on market.owner_id = person.id
    order by market.market_id desc
  `)
})

/* =====================================================
   RENT
===================================================== */

app.post('/rent', async (req, res) => {
  try {
    const { market_id, renter_id, starting_date, ending_date } = req.body

    const priceData = await sql`
      select price_to_rent_per_day from market
      where market_id = ${market_id}
    `

    const days =
      (new Date(ending_date) - new Date(starting_date)) /
        (1000 * 60 * 60 * 24) + 1

    const total_price = days * priceData[0].price_to_rent_per_day

    const result = await sql`
      insert into rent
      (market_id, renter_id, starting_date, ending_date, total_price)
      values (${market_id}, ${renter_id}, ${starting_date}, ${ending_date}, ${total_price})
      returning *
    `

    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/rent-details', async (req, res) => {
  res.json(await sql`
    select rent.rent_id, object.name as object_name,
    owner.name as owner_name, renter.name as renter_name,
    total_price, starting_date, ending_date
    from rent
    join market on rent.market_id = market.market_id
    join object on market.object_id = object.object_id
    join person owner on market.owner_id = owner.id
    join person renter on rent.renter_id = renter.id
    order by rent.rent_id desc
  `)
})

/* =====================================================
   SOLD
===================================================== */

app.post('/sold', async (req, res) => {
  try {
    const { market_id, buyer_id } = req.body

    const priceData = await sql`
      select price_to_buy from market where market_id = ${market_id}
    `

    const result = await sql`
      insert into sold (market_id, buyer_id, purchase_price)
      values (${market_id}, ${buyer_id}, ${priceData[0].price_to_buy})
      returning *
    `

    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/sold-details', async (req, res) => {
  res.json(await sql`
    select sold.sold_id, object.name as object_name,
    owner.name as owner_name, buyer.name as buyer_name,
    purchase_price, sold_date
    from sold
    join market on sold.market_id = market.market_id
    join object on market.object_id = object.object_id
    join person owner on market.owner_id = owner.id
    join person buyer on sold.buyer_id = buyer.id
    order by sold.sold_id desc
  `)
})

/* =====================================================
   FORUM TOPIC
===================================================== */

app.post('/forum-topic', async (req, res) => {
  try {
    const { topic_name, description } = req.body
    const result = await sql`
      insert into forum_topic (topic_name, description)
      values (${topic_name}, ${description})
      returning *
    `
    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/forum-topic', async (req, res) => {
  res.json(await sql`select * from forum_topic order by topic_name`)
})

/* =====================================================
   FORUM QUESTION
===================================================== */

app.post('/forum-question', async (req, res) => {
  try {
    const {
      author_id, topic_id, title, body,
      related_object_id,
      related_worker_contract_id,
      related_warehouse_contract_id
    } = req.body

    const result = await sql`
      insert into forum_question
      (author_id, topic_id, title, body,
       related_object_id,
       related_worker_contract_id,
       related_warehouse_contract_id)
      values (
        ${author_id}, ${topic_id}, ${title}, ${body},
        ${related_object_id ?? null},
        ${related_worker_contract_id ?? null},
        ${related_warehouse_contract_id ?? null}
      )
      returning *
    `

    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/forum-question', async (req, res) => {
  res.json(await sql`
    select fq.*, person.name as author_name, forum_topic.topic_name
    from forum_question fq
    join person on fq.author_id = person.id
    left join forum_topic on fq.topic_id = forum_topic.topic_id
    order by fq.created_at desc
  `)
})

/* =====================================================
   FORUM ANSWER
===================================================== */

app.post('/forum-answer', async (req, res) => {
  try {
    const { question_id, author_id, body } = req.body
    const result = await sql`
      insert into forum_answer (question_id, author_id, body)
      values (${question_id}, ${author_id}, ${body})
      returning *
    `
    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/forum-answer/:question_id', async (req, res) => {
  const { question_id } = req.params
  res.json(await sql`
    select fa.*, person.name as author_name
    from forum_answer fa
    join person on fa.author_id = person.id
    where fa.question_id = ${question_id}
    order by is_accepted_answer desc, created_at
  `)
})

app.put('/forum-answer/accept/:answer_id', async (req, res) => {
  const { answer_id } = req.params

  await sql`
    update forum_answer set is_accepted_answer = false
    where question_id = (
      select question_id from forum_answer where answer_id = ${answer_id}
    )
  `

  const result = await sql`
    update forum_answer
    set is_accepted_answer = true
    where answer_id = ${answer_id}
    returning *
  `

  res.json(result[0])
})

/* =====================================================
   FUNDRAISER
===================================================== */

app.post('/fundraiser', async (req, res) => {
  try {
    const { question_id, goal_amount } = req.body
    const result = await sql`
      insert into fundraiser (question_id, goal_amount)
      values (${question_id}, ${goal_amount})
      returning *
    `
    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

app.get('/fundraiser', async (req, res) => {
  res.json(await sql`
    select
      f.fundraiser_id, f.goal_amount, f.status, f.created_at,
      fq.title as question_title,
      person.name as question_author,
      coalesce(sum(d.amount),0) as total_donated
    from fundraiser f
    join forum_question fq on f.question_id = fq.question_id
    join person on fq.author_id = person.id
    left join donation d on d.fundraiser_id = f.fundraiser_id
    group by f.fundraiser_id, fq.title, person.name
    order by f.created_at desc
  `)
})

app.get('/fundraiser/:id', async (req, res) => {
  const { id } = req.params

  const fundraiser = await sql`
    select f.*, fq.title, fq.body, person.name as author_name
    from fundraiser f
    join forum_question fq on f.question_id = fq.question_id
    join person on fq.author_id = person.id
    where f.fundraiser_id = ${id}
  `

  const donations = await sql`
    select d.amount, d.donated_at, person.name as donor_name
    from donation d
    left join person on d.donor_id = person.id
    where fundraiser_id = ${id}
    order by donated_at desc
  `

  const total = await sql`
    select coalesce(sum(amount),0) as total
    from donation
    where fundraiser_id = ${id}
  `

  res.json({
    fundraiser: fundraiser[0],
    total_donated: total[0].total,
    donations
  })
})

/* =====================================================
   DONATION (AUTO STATUS UPDATE)
===================================================== */

app.post('/donation', async (req, res) => {
  try {
    const { fundraiser_id, donor_id, amount } = req.body

    const result = await sql`
      insert into donation (fundraiser_id, donor_id, amount)
      values (${fundraiser_id}, ${donor_id}, ${amount})
      returning *
    `

    const total = await sql`
      select sum(amount) as total
      from donation
      where fundraiser_id = ${fundraiser_id}
    `

    const goal = await sql`
      select goal_amount from fundraiser
      where fundraiser_id = ${fundraiser_id}
    `

    if (total[0].total >= goal[0].goal_amount) {
      await sql`
        update fundraiser
        set status = 'reached'
        where fundraiser_id = ${fundraiser_id}
      `
    }

    res.json(result[0])
  } catch (err) { res.status(500).json(err) }
})

/* ===================================================== */
            //login in 
/*====================================================*/
app.post('/signin', async (req, res) => {
  try {
    const { name, phone, password } = req.body

    const result = await sql`
      select * from person
      where name = ${name}
      and phone = ${phone}
    `

    // 🚫 no user
    if (result.length === 0) {
      return res.status(401).json({ error: 'User not found' })
    }

    const user = result[0]

    // 🚫 wrong password
    if (user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid password' })
    }

    // ✅ success
    res.json({
      message: 'Login successful ✅',
      user: {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url,
        community_credits: user.community_credits
      }
    })

  } catch (err) {
    res.status(500).json(err)
  }
})


/* ===================================================== */  
     // get id from name //  
app.get('/person/id/:name', async (req, res) => {
  try {
    const { name } = req.params

    const result = await sql`
      select id
      from person
      where name = ${name}
    `

    if (result.length === 0) {
      return res.status(404).json({ error: 'Person not found' })
    }

    res.json(result[0])   // { id: ... }

  } catch (err) {
    res.status(500).json(err)
  }
})
/* ===================================================== */
/* =====================================================
   WORKER SUMMARY (by person id)
===================================================== */
app.get('/worker-summary/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await sql`
      select
        p.id,
        p.name,

        wp.hourly_rate,

        count(distinct wc.contract_id) as total_contracts,

        coalesce(
          json_agg(
            distinct jsonb_build_object(
              'skill_id', ws.skill_id,
              'years_of_experience', ws.years_of_experience
            )
          ) filter (where ws.skill_id is not null),
          '[]'
        ) as skills

      from person p

      left join worker_profile wp
        on wp.person_id = p.id

      left join worker_contract wc
        on wc.worker_id = p.id

      left join worker_skill ws
        on ws.person_id = p.id

      where p.id = ${id}

      group by p.id, p.name, wp.hourly_rate
    `

    if (result.length === 0) {
      return res.status(404).json({ error: 'Worker not found' })
    }

    res.json(result[0])

  } catch (err) {
    res.status(500).json(err)
  }
})
/* ===================================================== */
/* =====================================================
   OBJECTS FOR SALE
===================================================== */
app.get('/objects-for-sale', async (req, res) => {
  try {
    const result = await sql`
      select
        o.object_id,
        o.name,
        o.description,
        o.company,
        o.tag,
        m.price_to_buy,
        m.listing_type
      from object o
      join market m
        on o.object_id = m.object_id
      where m.listing_type in ('buy', 'both')
      order by m.created_at desc
    `

    res.json(result)

  } catch (err) {
    res.status(500).json(err)
  }
})
/* =====================================================
   OBJECTS FOR SALE BY TAG
===================================================== */
app.get('/objects-for-sale/tag/:tag', async (req, res) => {
  try {
    const { tag } = req.params

    const result = await sql`
      select
        o.object_id,
        o.name,
        o.description,
        o.company,
        o.tag,
        m.price_to_buy,
        m.listing_type
      from object o
      join market m
        on o.object_id = m.object_id
      where m.listing_type in ('buy', 'both')
      and o.tag = ${tag}
      order by m.created_at desc
    `

    res.json(result)

  } catch (err) {
    res.status(500).json(err)
  }
})
/* ===================================================== */
/* =====================================================
   OBJECTS FOR RENT BY TAG
===================================================== */
app.get('/objects-for-rent/tag/:tag', async (req, res) => {
  try {
    const { tag } = req.params

    const result = await sql`
      select
        o.object_id,
        o.name,
        o.description,
        o.company,
        o.tag,
        m.price_to_rent_per_day,
        m.listing_type
      from object o
      join market m
        on o.object_id = m.object_id
      where m.listing_type in ('rent', 'both')
      and o.tag = ${tag}
      order by m.created_at desc
    `

    res.json(result)

  } catch (err) {
    res.status(500).json(err)
  }
})
/* =====================================================
   ALL OBJECTS AVAILABLE FOR RENT
===================================================== */
app.get('/objects-for-rent', async (req, res) => {
  try {
    const result = await sql`
      select
        o.object_id,
        o.name,
        o.description,
        o.company,
        o.tag,
        m.price_to_rent_per_day,
        m.listing_type
      from object o
      join market m
        on o.object_id = m.object_id
      where m.listing_type in ('rent', 'both')
      order by m.created_at desc
    `

    res.json(result)

  } catch (err) {
    res.status(500).json(err)
  }
})
//* ===================================================== */

/* =====================================================
   LAST FORUM POST
===================================================== */
app.get('/forum-question/latest', async (req, res) => {
  try {
    const result = await sql`
      select
        fq.question_id,
        fq.title,
        fq.body,
        fq.created_at,

        p.name as author_name,
        ft.topic_name

      from forum_question fq

      join person p
        on fq.author_id = p.id

      left join forum_topic ft
        on fq.topic_id = ft.topic_id

      order by fq.created_at desc
      limit 1
    `

    res.json(result[0])

  } catch (err) {
    res.status(500).json(err)
  }
})
//* ===================================================== */
/* =====================================================
   ANSWERS FOR A QUESTION
===================================================== */
app.get('/forum-answer/question/:question_id', async (req, res) => {
  try {
    const { question_id } = req.params

    const result = await sql`
      select
        fa.answer_id,
        fa.body,
        fa.is_accepted_answer,
        fa.created_at,
        p.name as author_name

      from forum_answer fa

      join person p
        on fa.author_id = p.id

      where fa.question_id = ${question_id}

      order by
        fa.is_accepted_answer desc,
        fa.created_at asc
    `

    res.json(result)

  } catch (err) {
    res.status(500).json(err)
  }
})


/* =====================================================
   QUESTION DETAIL + FUNDRAISER (IF EXISTS)
===================================================== */
app.get('/forum-question/:id/details', async (req, res) => {
  try {
    const { id } = req.params

    /* ---------- QUESTION ---------- */
    const question = await sql`
      select
        fq.question_id,
        fq.title,
        fq.body,
        fq.created_at,
        p.name as author_name,
        ft.topic_name
      from forum_question fq
      join person p on fq.author_id = p.id
      left join forum_topic ft on fq.topic_id = ft.topic_id
      where fq.question_id = ${id}
    `

    if (question.length === 0) {
      return res.status(404).json({ error: 'Question not found' })
    }

    /* ---------- FUNDRAISER (IF EXISTS) ---------- */
    const fundraiser = await sql`
      select *
      from fundraiser
      where question_id = ${id}
    `

    let fundraiserData = null

    if (fundraiser.length > 0) {

      const donations = await sql`
        select
          d.amount,
          p.name as donor_name
        from donation d
        left join person p
          on d.donor_id = p.id
        where d.fundraiser_id = ${fundraiser[0].fundraiser_id}
        order by d.donated_at desc
      `

      const total = await sql`
        select coalesce(sum(amount), 0) as total_donated
        from donation
        where fundraiser_id = ${fundraiser[0].fundraiser_id}
      `

      fundraiserData = {
        fundraiser_id: fundraiser[0].fundraiser_id,
        goal_amount: fundraiser[0].goal_amount,
        status: fundraiser[0].status,
        total_donated: total[0].total_donated,
        donations
      }
    }

    /* ---------- FINAL RESPONSE ---------- */
    res.json({
      ...question[0],
      fundraiser: fundraiserData
    })

  } catch (err) {
    res.status(500).json(err)
  }
})

/* =====================================================
   ADD COMMUNITY CREDITS
===================================================== */
app.put('/person/:id/add-credits', async (req, res) => {
  try {
    const { id } = req.params
    const { amount } = req.body

    const result = await sql`
      update person
      set community_credits = community_credits + ${amount}
      where id = ${id}
      returning id, name, community_credits
    `

    if (result.length === 0) {
      return res.status(404).json({ error: 'Person not found' })
    }

    res.json(result[0])

  } catch (err) {
    res.status(500).json(err)
  }
})
/* =====================================================
   PERSON DASHBOARD
===================================================== */
app.get('/person/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params

    /* ---------- BASIC INFO ---------- */
    const person = await sql`
      select id, name, phone, avatar_url, community_credits
      from person
      where id = ${id}
    `

    if (person.length === 0) {
      return res.status(404).json({ error: 'Person not found' })
    }

    /* ---------- EQUIPMENTS LISTED ---------- */
    const equipments = await sql`
      select
        m.market_id,
        o.object_id,
        o.name,
        m.listing_type,
        m.price_to_buy,
        m.price_to_rent_per_day
      from market m
      join object o on m.object_id = o.object_id
      where m.owner_id = ${id}
      order by m.created_at desc
    `

    /* ---------- FORUM POSTS ---------- */
    const posts = await sql`
      select
        question_id,
        title,
        created_at
      from forum_question
      where author_id = ${id}
      order by created_at desc
    `

    /* ---------- ACTIVE WORKER CONTRACTS ---------- */
    const workerContracts = await sql`
      select *
      from worker_contract
      where (worker_id = ${id} or hirer_id = ${id})
      and contract_status = 'active'
      order by start_time desc
    `

    /* ---------- ACTIVE WAREHOUSE CONTRACTS ---------- */
    const warehouseContracts = await sql`
      select wc.*, w.name as warehouse_name
      from warehouse_contract wc
      join warehouse w on wc.warehouse_id = w.warehouse_id
      where wc.renter_id = ${id}
      and wc.contract_status = 'active'
      order by wc.start_time desc
    `

    /* ---------- RESPONSE ---------- */
    res.json({
      person: person[0],
      equipments_listed: equipments,
      forum_posts: posts,
      active_worker_contracts: workerContracts,
      active_warehouse_contracts: warehouseContracts
    })

  } catch (err) {
    res.status(500).json(err)
  }
})

/* =====================================================
   UPDATE PERSON PROFILE
===================================================== */
app.put('/person/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, phone, password } = req.body

    const result = await sql`
      update person
      set
        name = coalesce(${name}, name),
        phone = coalesce(${phone}, phone),
        password_hash = coalesce(${password}, password_hash)
      where id = ${id}
      returning id, name, phone, avatar_url, community_credits
    `

    if (result.length === 0) {
      return res.status(404).json({ error: 'Person not found' })
    }

    res.json(result[0])

  } catch (err) {
    res.status(500).json(err)
  }
})
const PORT = process.env.PORT || 3000

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`))

