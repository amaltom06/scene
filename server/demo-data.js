/**
 * Fictional, connected demo content for SCENE. All locations are illustrative
 * neighbourhood pins, and none of these listings represents a real event.
 * Dates roll forward from the seed time in India Standard Time.
 */
export function buildDemoData({ now = new Date() } = {}) {
  const reference = new Date(now)
  if (!Number.isFinite(reference.getTime())) throw new TypeError('A valid demo reference date is required.')

  const minute = 60_000
  const hour = 60 * minute
  const indiaOffset = 330 * minute
  const indiaNow = new Date(reference.getTime() + indiaOffset)
  const day = (offset, hours = 18, minutes = 0) => new Date(Date.UTC(
    indiaNow.getUTCFullYear(), indiaNow.getUTCMonth(), indiaNow.getUTCDate() + offset, hours, minutes,
  ) - indiaOffset)
  const nextSaturday = (6 - indiaNow.getUTCDay() + 7) % 7
  const weekendOffset = day(nextSaturday, 9).getTime() > reference.getTime() ? nextSaturday : nextSaturday + 7
  const soon = (minutes) => new Date(reference.getTime() + minutes * minute)
  const photo = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=85`
  const images = {
    coffee: photo('photo-1501339847302-ac426a4a7cbb'),
    people: photo('photo-1528605248644-14dd04022da1'),
    music: photo('photo-1516280440614-37939bbacd81'),
    concert: photo('photo-1514525253161-7a46d19cd819'),
    festival: photo('photo-1492684223066-81342ee5ff30'),
    art: photo('photo-1513364776144-60967b0f800f'),
    workshop: photo('photo-1523580494863-6f3031224c94'),
    food: photo('photo-1511690743698-d9d85f2fbf38'),
    wellness: photo('photo-1506126613408-eca07ce68773'),
    sport: photo('photo-1547347298-4074fc3086f0'),
    cinema: photo('photo-1489599849927-2ee91cede3ba'),
    outdoors: photo('photo-1519681393784-d120267933ba'),
    architecture: photo('photo-1518005020951-eccb494ad742'),
    baking: photo('photo-1509440159596-0249088772ff'),
    networking: photo('photo-1531058020387-3be344556be6'),
  }
  const profile = (key, displayName, city, interests, bio) => ({
    demoKey: key, username: `demo_${key}`, email: `demo_${key}@demo.scene.test`,
    displayName, city, interests, bio: `${bio} Demo profile.`, avatar: `/demo/avatars/demo_${key}.svg`,
  })
  const users = [
    profile('aarav', 'Aarav Menon', 'Kochi', ['Food Meetups', 'Outdoor Activities', 'Gaming'], 'Product designer in Kochi. Usually up for a sunset walk, a board game, or finding the next good dosa spot.'),
    profile('meera', 'Meera Nair', 'Kochi', ['Art and Culture', 'Workshops', 'Movie Screenings'], 'Illustrator with a sketchbook in every bag. Hosting small creative meetups where beginners feel at home.'),
    profile('rohan', 'Rohan Thomas', 'Kochi', ['Sports', 'Gaming', 'Casual Hangouts'], 'Weekend badminton, weekday coffee. Happy to explain the rules before the first game.'),
    profile('nila', 'Nila Joseph', 'Kochi', ['Concerts', 'Theatre', 'Art and Culture'], 'Singer and theatre enthusiast. I like intimate acoustic sets and conversations after the show.'),
    profile('devika', 'Devika Pillai', 'Kochi', ['Wellness', 'Outdoor Activities', 'Community Events'], 'Early riser who enjoys slow walks, gentle movement, and keeping our neighbourhood a little greener.'),
    profile('farhan', 'Farhan Ali', 'Kochi', ['Food Meetups', 'Comedy', 'Nightlife'], 'Amateur cook and enthusiastic taste tester. Always looking for company to try a new recipe.'),
    profile('ananya', 'Ananya Varghese', 'Kochi', ['Workshops', 'Networking', 'Experiences'], 'UX researcher, beginner potter, and curious learner. I organise hands-on sessions with room for questions.'),
    profile('joel', 'Joel Mathew', 'Kochi', ['Movie Screenings', 'Gaming', 'Concerts'], 'Film club regular. Bring a favourite recommendation and I will probably add it to my very long watchlist.'),
    profile('lakshmi', 'Lakshmi Suresh', 'Kochi', ['Kids and Family', 'Community Events', 'Art and Culture'], 'Library volunteer who loves stories, collage workshops, and activities families can enjoy together.'),
    profile('kiran', 'Kiran Das', 'Kochi', ['Outdoor Activities', 'Sports', 'Festivals'], 'Cycling and photography on weekends. My preferred pace leaves enough time to notice the city.'),
    profile('diya', 'Diya Roy', 'Kochi', ['College Festivals', 'DJ Nights', 'Parties'], 'Student and campus events volunteer. I help new faces find their people through music and small gatherings.'),
    profile('riya', 'Riya Rao', 'Bengaluru', ['Networking', 'Workshops', 'Casual Hangouts'], 'New to Bengaluru and building a circle beyond work. Coffee chats and practical workshops are my thing.'),
    profile('arjun', 'Arjun Kumar', 'Bengaluru', ['Sports', 'Gaming', 'Outdoor Activities'], 'Engineer, board-game explainer, and occasional runner. Welcoming people who are trying something for the first time.'),
    profile('sneha', 'Sneha Iyer', 'Bengaluru', ['Wellness', 'Food Meetups', 'Art and Culture'], 'Home baker and weekend urban sketcher. Small groups, thoughtful conversations, and excellent chai.'),
    profile('tara', 'Tara Shah', 'Mumbai', ['Theatre', 'Comedy', 'Movie Screenings'], 'Copywriter who spends weekends at readings and open mics. Looking for stories and people worth remembering.'),
    profile('kabir', 'Kabir Patil', 'Mumbai', ['Concerts', 'Food Meetups', 'Experiences'], 'Bass guitarist, street-food fan, and patient photo-walk companion. I enjoy making a big city feel a little smaller.'),
    profile('asha', 'Asha Krishnan', 'Thiruvananthapuram', ['Art and Culture', 'Community Events', 'Workshops'], 'Ceramics hobbyist and reading-circle organiser. I like sharing skills without making anyone feel behind.'),
    profile('ishan', 'Ishan Reddy', 'Hyderabad', ['Networking', 'Food Meetups', 'Gaming'], 'Developer who loves collaborative projects and leisurely chai breaks. Hosting friendly meetups for curious people.'),
    profile('zoya', 'Zoya Khan', 'Delhi', ['Art and Culture', 'Outdoor Activities', 'Experiences'], 'Photographer and museum-day planner. I enjoy noticing little details and hearing how other people see them.'),
    profile('ved', 'Ved Sharma', 'Delhi', ['Comedy', 'Movie Screenings', 'Community Events'], 'Research student, cinema fan, and a regular at neighbourhood story circles. Happy to welcome someone joining solo.'),
  ]
  users[0].savedSceneKeys = ['kochi-acoustic', 'kochi-pottery', 'kochi-weekend-sketch', 'kochi-film-night']

  // Approximate neighbourhood centres, not the coordinates of actual businesses.
  const locations = {
    fortKochi: { city: 'Kochi', area: 'Fort Kochi', latitude: 9.9658, longitude: 76.2421, address: 'Fort Kochi, Kochi, Kerala 682001 — illustrative demo location' },
    panampilly: { city: 'Kochi', area: 'Panampilly Nagar', latitude: 9.9565, longitude: 76.2995, address: 'Panampilly Nagar, Kochi, Kerala 682036 — illustrative demo location' },
    kakkanad: { city: 'Kochi', area: 'Kakkanad', latitude: 10.0159, longitude: 76.3419, address: 'Kakkanad, Kochi, Kerala 682030 — illustrative demo location' },
    marine: { city: 'Kochi', area: 'Marine Drive', latitude: 9.9816, longitude: 76.2753, address: 'Marine Drive, Kochi, Kerala 682031 — illustrative demo location' },
    edappally: { city: 'Kochi', area: 'Edappally', latitude: 10.0261, longitude: 76.3084, address: 'Edappally, Kochi, Kerala 682024 — illustrative demo location' },
    vytilla: { city: 'Kochi', area: 'Vyttila', latitude: 9.9679, longitude: 76.3179, address: 'Vyttila, Kochi, Kerala 682019 — illustrative demo location' },
    indiranagar: { city: 'Bengaluru', area: 'Indiranagar', latitude: 12.9784, longitude: 77.6408, address: 'Indiranagar, Bengaluru, Karnataka 560038 — illustrative demo location' },
    koramangala: { city: 'Bengaluru', area: 'Koramangala', latitude: 12.9352, longitude: 77.6245, address: 'Koramangala, Bengaluru, Karnataka 560034 — illustrative demo location' },
    jayanagar: { city: 'Bengaluru', area: 'Jayanagar', latitude: 12.9250, longitude: 77.5938, address: 'Jayanagar, Bengaluru, Karnataka 560041 — illustrative demo location' },
    bandra: { city: 'Mumbai', area: 'Bandra West', latitude: 19.0596, longitude: 72.8295, address: 'Bandra West, Mumbai, Maharashtra 400050 — illustrative demo location' },
    andheri: { city: 'Mumbai', area: 'Andheri West', latitude: 19.1364, longitude: 72.8296, address: 'Andheri West, Mumbai, Maharashtra 400053 — illustrative demo location' },
    colaba: { city: 'Mumbai', area: 'Colaba', latitude: 18.9067, longitude: 72.8147, address: 'Colaba, Mumbai, Maharashtra 400005 — illustrative demo location' },
    pattom: { city: 'Thiruvananthapuram', area: 'Pattom', latitude: 8.5195, longitude: 76.9418, address: 'Pattom, Thiruvananthapuram, Kerala 695004 — illustrative demo location' },
    kowdiar: { city: 'Thiruvananthapuram', area: 'Kowdiar', latitude: 8.5255, longitude: 76.9630, address: 'Kowdiar, Thiruvananthapuram, Kerala 695003 — illustrative demo location' },
    jubilee: { city: 'Hyderabad', area: 'Jubilee Hills', latitude: 17.4325, longitude: 78.4070, address: 'Jubilee Hills, Hyderabad, Telangana 500033 — illustrative demo location' },
    gachibowli: { city: 'Hyderabad', area: 'Gachibowli', latitude: 17.4401, longitude: 78.3489, address: 'Gachibowli, Hyderabad, Telangana 500032 — illustrative demo location' },
    hauzKhas: { city: 'Delhi', area: 'Hauz Khas', latitude: 28.5494, longitude: 77.2001, address: 'Hauz Khas, New Delhi, Delhi 110016 — illustrative demo location' },
    lodhi: { city: 'Delhi', area: 'Lodhi Colony', latitude: 28.5886, longitude: 77.2230, address: 'Lodhi Colony, New Delhi, Delhi 110003 — illustrative demo location' },
  }
  const names = (keys) => keys.map((key) => `demo_${key}`)
  const scene = (key, host, title, category, place, venue, start, duration, members, details = {}) => {
    const { description, image = 'people', ...options } = details
    return {
      demoKey: key, hostUsername: `demo_${host}`, title, category,
      description: `Demo event. ${description || 'A friendly, free community gathering. Join solo or with a friend; new faces are welcome.'}`,
      ...locations[place], venue: `${venue} (Demo)`,
      startsAt: start, endsAtDate: new Date(start.getTime() + duration * hour),
      timezone: 'Asia/Kolkata', capacity: 12,
      memberUsernames: [...new Set(names([host, ...members]))], requests: [],
      kind: 'planned', joinType: 'open', publication: 'published', visibility: 'public', status: 'open', liveConfirmed: false,
      tags: ['free', 'beginner-friendly', 'community'],
      instructions: 'Arrive about 10 minutes early and introduce yourself to the host. The listing and meeting pin are illustrative demo content.',
      image: images[image], price: 0, paymentRequired: false, ...options,
    }
  }
  const scenes = [
    scene('kochi-coffee-now', 'rohan', 'Coffee, conversation, and a spare chair', 'Casual Hangouts', 'panampilly', 'Third Chair Coffee Room', soon(-30), 2, ['aarav', 'farhan', 'ananya'], { kind: 'quick', liveConfirmed: true, capacity: 10, image: 'coffee', tags: ['happening-now', 'coffee', 'join-solo'], description: 'We have a small table, fresh coffee, and room for a few more people. Drop in for a relaxed conversation about films, food, and life in Kochi.', instructions: 'Look for the host at the illustrated community table. No activity preparation is needed.' }),
    scene('kochi-sunset-walk', 'kiran', 'A slow walk by the waterfront', 'Outdoor Activities', 'marine', 'Waterfront Walk Circle', soon(75), 1.5, ['aarav', 'devika', 'meera'], { kind: 'quick', capacity: 14, image: 'outdoors', tags: ['spontaneous', 'walking', 'photography'], description: 'An easy-paced waterfront walk with stops for photographs and conversation. Come in comfortable shoes; you do not need a camera to join.' }),
    scene('kochi-chess-tonight', 'joel', 'Evening chess and filter coffee', 'Gaming', 'panampilly', 'Checkmate Community Table', day(0, 20), 2, ['rohan', 'farhan'], { capacity: 8, image: 'coffee', tags: ['chess', 'coffee', 'beginner-friendly'], description: 'Casual chess, quick games, and patient explanations for first-time players. We will pair people by comfort level and keep a board free for learning.' }),
    scene('kochi-acoustic', 'nila', 'Acoustic songs under warm lights', 'Concerts', 'fortKochi', 'Lantern Courtyard', day(2, 19), 2, ['aarav', 'meera', 'joel', 'diya'], { capacity: 24, image: 'music', tags: ['acoustic', 'local-music', 'seated'], description: 'An intimate community acoustic session with original songs and a few familiar favourites. Bring a friend or come alone; seating is first come, first served.' }),
    scene('kochi-pottery', 'ananya', 'Make your first clay pinch pot', 'Workshops', 'fortKochi', 'Soft Earth Demo Studio', day(3, 10), 2.5, ['meera', 'devika', 'lakshmi'], { capacity: 10, joinType: 'approval', requests: [{ userName: 'demo_aarav', status: 'PENDING' }, { userName: 'demo_kiran', status: 'PENDING' }], image: 'art', registrationDeadline: day(2, 20), tags: ['pottery', 'hands-on', 'small-group'], description: 'A slow, beginner-friendly introduction to hand-building. Practice pinching, shaping, and adding texture with shared materials. No previous pottery experience is needed.' }),
    scene('kochi-weekend-sketch', 'meera', 'Fort Kochi sketchbook morning', 'Art and Culture', 'fortKochi', 'Paper Lantern Sketch Circle', day(weekendOffset, 9), 2, ['aarav', 'ananya', 'kiran'], { capacity: 16, image: 'art', tags: ['this-weekend', 'urban-sketching', 'all-levels'], description: 'Draw the shapes, colours, and little details of a neighbourhood morning. We will warm up with quick sketches, then share what we noticed over tea.', instructions: 'Bring a sketchbook, a pencil, drinking water, and something comfortable to sit on. Materials are optional in this demo.' }),
    scene('kochi-film-night', 'joel', 'Short films and a long conversation', 'Movie Screenings', 'kakkanad', 'Frame by Frame Community Room', day(4, 18, 30), 2.5, ['aarav', 'nila', 'meera', 'farhan'], { capacity: 20, image: 'cinema', tags: ['short-films', 'discussion', 'film-club'], description: 'A community film-club format with short fictional programme selections and a guided discussion afterwards. Expect a friendly space where everyone can share an observation.' }),
    scene('kochi-badminton', 'rohan', 'Beginner badminton doubles', 'Sports', 'vytilla', 'Rally Together Demo Court', day(1, 7), 1.5, ['aarav', 'kiran', 'devika'], { capacity: 8, image: 'sport', tags: ['badminton', 'morning', 'beginners'], description: 'Low-pressure doubles with rotating partners. We will start with a short warm-up, explain scoring, and keep the games friendly.', instructions: 'Wear non-marking sports shoes and bring water. Bring a racket if you have one; shared equipment is part of this fictional demo.' }),
    scene('kochi-food-stories', 'farhan', 'Recipes, chai, and food stories', 'Food Meetups', 'edappally', 'Shared Spoon Community Kitchen', day(1, 18), 2, ['aarav', 'lakshmi', 'ananya'], { capacity: 12, image: 'food', tags: ['food-stories', 'chai', 'vegetarian-options'], description: 'Meet people through the dishes they grew up with. Share a recipe, a food memory, or just your curiosity. The sample menu includes vegetarian options; tell the host about allergies.' }),
    scene('kochi-comedy', 'farhan', 'Five-minute stories and first-time laughs', 'Comedy', 'panampilly', 'Little Laugh Room', day(5, 19), 2, ['rohan', 'diya', 'joel'], { capacity: 28, image: 'people', tags: ['open-mic', 'storytelling', 'community'], description: 'A friendly comedy and funny-story circle for people testing a first five minutes. Sign up to speak or simply enjoy the room. We keep the material welcoming.' }),
    scene('kochi-theatre', 'aarav', 'Read a scene, find your voice', 'Theatre', 'fortKochi', 'Side Stage Reading Room', day(6, 16), 2, ['nila', 'meera', 'lakshmi', 'devika'], { capacity: 12, joinType: 'approval', requests: [{ userName: 'demo_kiran', status: 'PENDING' }, { userName: 'demo_diya', status: 'PENDING' }], image: 'workshop', tags: ['play-reading', 'no-experience-needed', 'small-group'], description: 'Aarav hosts a relaxed reading circle while Nila guides a few light theatre exercises. Join as a reader or listener; there is no audition and no performance pressure.' }),
    scene('kochi-yoga', 'devika', 'Gentle movement before breakfast', 'Wellness', 'marine', 'Morning Pause Community Space', day(weekendOffset + 1, 7), 1, ['lakshmi', 'ananya', 'kiran'], { capacity: 15, image: 'wellness', tags: ['gentle-movement', 'morning', 'all-levels'], description: 'A gentle community stretch-and-breathe session at an easy pace. Every movement is optional; take breaks whenever you need them.', instructions: 'Bring water, a mat or towel, and comfortable clothing. This is a fictional social wellness session, not medical advice or a treatment.' }),
    scene('kochi-family-stories', 'lakshmi', 'Storytime and paper-bird crafts', 'Kids and Family', 'edappally', 'Little Pages Family Room', day(weekendOffset, 15), 1.5, ['devika', 'meera'], { capacity: 18, image: 'workshop', tags: ['families', 'storytime', 'crafts'], description: 'A cosy story circle followed by a simple paper craft. Designed for families with children aged 5–10. Adults participate with their children throughout the session.', instructions: 'Each child must be accompanied by their parent or guardian. Bring a reusable water bottle; craft supplies are included in this demo.' }),
    scene('kochi-cleanup', 'devika', 'Neighbourhood clean-up and chai', 'Community Events', 'panampilly', 'Green Corner Volunteer Hub', day(weekendOffset + 1, 8, 30), 2, ['aarav', 'kiran', 'rohan', 'lakshmi'], { capacity: 25, image: 'people', tags: ['volunteering', 'community', 'outdoors'], description: 'Spend a little time caring for a shared neighbourhood space, then meet the group over chai. We will work in pairs and stick to simple, safe tasks.' }),
    scene('kochi-design-circle', 'ananya', 'Designers meet: one problem, three ideas', 'Networking', 'kakkanad', 'Open Desk Demo Hub', day(2, 17, 30), 2, ['aarav', 'meera', 'rohan'], { capacity: 16, image: 'networking', tags: ['design', 'career-chat', 'peer-feedback'], description: 'Bring a small design challenge or a question about your work. We will exchange ideas in groups of three and leave time for introductions. Students and career switchers are welcome.' }),
    scene('kochi-dj-lab', 'diya', 'Listening room: discover a new DJ set', 'DJ Nights', 'kakkanad', 'Afterglow Demo Listening Room', day(6, 20), 2, ['farhan', 'nila', 'joel'], { capacity: 30, image: 'concert', tags: ['electronic-music', 'listening-party', '18-plus'], description: 'A free community listening session built around electronic music and conversations about tracks. A fictional programme for adults aged 18 and over; no alcohol service is included.' }),
    scene('kochi-night-market', 'farhan', 'Evening food and photo wander', 'Nightlife', 'fortKochi', 'Lantern Lane Demo Meeting Point', day(7, 19), 2, ['kiran', 'diya', 'aarav'], { capacity: 10, image: 'festival', tags: ['evening-walk', 'photography', '18-plus'], description: 'A small evening group walk for conversation, photography, and sharing food recommendations. Joining is free; any personal food purchases would be optional in a real outing.' }),
    scene('kochi-boardgame-party', 'joel', 'Bring a game, meet a new teammate', 'Parties', 'panampilly', 'Shuffle House Community Room', day(weekendOffset, 18), 3, ['rohan', 'farhan', 'diya'], { capacity: 16, image: 'people', tags: ['board-games', 'social', 'join-solo'], description: 'A relaxed board-game social with short party games and a table for longer strategy games. Hosts will teach the rules and help solo arrivals find a group.' }),
    scene('kochi-arts-festival', 'meera', 'Neighbourhood makers and music day', 'Festivals', 'fortKochi', 'Makers Courtyard Demo Space', day(10, 11), 5, ['nila', 'ananya', 'lakshmi', 'kiran'], { capacity: 50, image: 'festival', tags: ['community-festival', 'makers', 'music'], description: 'A fictional neighbourhood festival with sketch corners, creative show-and-tell, and acoustic music. Meet local hobbyists and try a short creative exercise.' }),
    scene('kochi-campus-fest', 'diya', 'Campus creatives: ideas on a small stage', 'College Festivals', 'kakkanad', 'Campus Commons Demo Hall', day(12, 14), 4, ['nila', 'joel', 'ananya'], { capacity: 60, image: 'workshop', tags: ['students', 'showcase', 'creative-clubs'], description: 'An independent fictional student showcase: music, short scenes, posters, and club introductions. This listing is not affiliated with any real college or institution.' }),
    scene('kochi-photo-experience', 'kiran', 'Tell a story in five photographs', 'Experiences', 'fortKochi', 'Five Frames Demo Walk Point', day(8, 8), 2.5, ['meera', 'aarav', 'ananya'], { capacity: 10, image: 'architecture', tags: ['phone-photography', 'creative-walk', 'storytelling'], description: 'Use a phone or camera to make a five-frame story about a neighbourhood morning. We will try a few prompts and finish by sharing the photographs we like most.' }),
    scene('kochi-past-breakfast', 'aarav', 'Sunday breakfast and new introductions', 'Food Meetups', 'panampilly', 'Common Table Breakfast Room', day(-3, 9), 2, ['rohan', 'meera', 'farhan', 'devika'], { capacity: 10, image: 'food', tags: ['past-meetup', 'breakfast', 'community'], description: 'A completed demo meetup: a shared breakfast table, favourite neighbourhood recommendations, and introductions to people who came on their own.' }),
    scene('kochi-cancelled-walk', 'kiran', 'Harbour photo walk — cancelled', 'Outdoor Activities', 'fortKochi', 'Harbour Lens Demo Meeting Point', day(3, 7), 2, ['aarav', 'meera'], { status: 'cancelled', capacity: 10, image: 'architecture', tags: ['cancelled', 'photo-walk'], description: 'Cancelled demo event. The host has postponed this example walk because the sample weather plan changed. Existing demo attendees can see the cancelled status in My plans.' }),
    scene('kochi-aarav-draft', 'aarav', 'Sunday board-game brunch', 'Gaming', 'panampilly', 'Common Table Demo Room', day(9, 11), 3, [], { publication: 'draft', visibility: 'private', capacity: 8, image: 'coffee', tags: ['host-draft', 'board-games', 'brunch'], description: 'An unpublished demo draft. Aarav is deciding which beginner-friendly games to bring and checking a small brunch table plan before publishing.' }),

    scene('bengaluru-coffee', 'riya', 'New to Bengaluru? Start with coffee', 'Casual Hangouts', 'indiranagar', 'Neighbourhood Hello Coffee Room', day(1, 18), 2, ['arjun', 'sneha'], { capacity: 12, image: 'coffee', description: 'Meet other people building a circle in the city. Bring a question, a recommendation, or just yourself. We will make introductions so no one has to stand around alone.' }),
    scene('bengaluru-product', 'riya', 'Build together: product and design circle', 'Networking', 'koramangala', 'Shared Notes Demo Hub', day(3, 18, 30), 2, ['arjun', 'sneha'], { capacity: 20, image: 'networking', tags: ['product', 'design', 'peer-learning'], description: 'Short introductions, practical product questions, and peer feedback on ideas. Open to students, designers, developers, and people exploring a career change.' }),
    scene('bengaluru-bake', 'sneha', 'A loaf, a recipe, and a new friend', 'Food Meetups', 'jayanagar', 'Crumb & Chai Community Kitchen', day(weekendOffset, 11), 2, ['riya', 'arjun'], { capacity: 10, image: 'baking', tags: ['baking', 'recipe-swap', 'allergen-awareness'], description: 'A friendly recipe exchange for beginner home bakers. Compare notes about ingredients and share what worked. The fictional tasting table includes clear ingredient cards.' }),
    scene('bengaluru-games-full', 'arjun', 'Strategy Saturday: the table is full', 'Gaming', 'koramangala', 'Next Move Demo Clubroom', day(weekendOffset, 16), 3, ['riya', 'sneha'], { capacity: 3, image: 'people', tags: ['sold-out', 'board-games', 'strategy'], description: 'A deliberately full demo meetup for testing availability. All three seats are already taken for a small strategy-game session; joining should be unavailable.' }),
    scene('bengaluru-sketch', 'sneha', 'Shapes and shadows: urban sketch walk', 'Art and Culture', 'indiranagar', 'Pencil Pause Demo Meeting Point', day(weekendOffset + 1, 9), 2, ['riya', 'arjun'], { capacity: 14, image: 'art', description: 'A beginner-friendly sketch walk using buildings, trees, and everyday details as prompts. We will share a few easy ways to start a page when the blank paper feels intimidating.' }),
    scene('bengaluru-private-run', 'arjun', 'Friends-only easy morning run', 'Sports', 'jayanagar', 'Easy Pace Demo Circle', day(2, 6, 30), 1, ['riya', 'sneha'], { visibility: 'private', capacity: 6, image: 'sport', tags: ['private', 'easy-pace', 'friends'], description: 'A private demo plan among confirmed friends. An easy conversational-pace loop, with walking breaks and a stretch afterwards. Visible to the host and confirmed attendees.' }),

    scene('mumbai-reading', 'tara', 'Scripts, stories, and a shared stage', 'Theatre', 'bandra', 'Small Stage Demo Room', day(4, 17), 2, ['kabir'], { capacity: 14, image: 'workshop', description: 'Read short original practice scenes and swap thoughts about characters. Choose a part, listen, or try a small exercise; first-timers are very welcome.' }),
    scene('mumbai-acoustic', 'kabir', 'Unplugged by the neighbourhood', 'Concerts', 'andheri', 'Soft Note Demo Courtyard', day(weekendOffset, 19), 2, ['tara'], { capacity: 24, image: 'music', tags: ['acoustic', 'community-music', 'free'], description: 'A small fictional acoustic evening featuring community musicians, short sets, and time to meet other listeners. The sample programme includes originals and instrumental pieces.' }),
    scene('mumbai-photo-walk', 'kabir', 'Colaba in details: a phone photo walk', 'Experiences', 'colaba', 'City Detail Demo Meeting Point', day(6, 8), 2, ['tara'], { capacity: 12, image: 'architecture', description: 'Look for colours, signs, textures, and small everyday stories on an easy-paced photo walk. A phone is enough, and the group will share a favourite frame at the end.' }),
    scene('mumbai-comedy', 'tara', 'Small room, big stories', 'Comedy', 'bandra', 'Punchline Practice Demo Room', day(8, 19), 2, ['kabir'], { capacity: 20, image: 'people', description: 'An informal, welcoming story-and-comedy circle. Try a short piece, ask for constructive feedback, or support people sharing for the first time.' }),

    scene('trivandrum-clay', 'asha', 'Clay textures and quiet conversation', 'Workshops', 'pattom', 'Handmade Hours Demo Studio', day(5, 10), 2, ['devika'], { capacity: 10, image: 'art', tags: ['clay', 'beginner-friendly', 'slow-making'], description: 'A fictional weekend skill-share led by a ceramics hobbyist, with a visiting friend from Kochi. Explore simple textures and shapes without worrying about a perfect finished object.' }),
    scene('trivandrum-reading', 'asha', 'Bring a book, borrow a recommendation', 'Community Events', 'kowdiar', 'Open Page Demo Reading Circle', day(weekendOffset + 1, 16), 2, ['lakshmi'], { capacity: 12, image: 'coffee', tags: ['books', 'reading-circle', 'community'], description: 'Bring a book you enjoyed, listen to recommendations, and share one passage in your own words. A small fictional reading-circle visit with a library-volunteer friend from Kochi.' }),

    scene('hyderabad-builders', 'ishan', 'Weekend builders: show what you are making', 'Networking', 'gachibowli', 'Ship & Share Demo Hub', day(weekendOffset, 11), 2.5, ['riya'], { capacity: 20, image: 'networking', tags: ['makers', 'side-projects', 'peer-feedback'], description: 'A free demo show-and-tell for side projects, tiny prototypes, and early ideas. A visiting Bengaluru friend joins the first round; unfinished work and curious listeners are welcome.' }),
    scene('hyderabad-chai', 'ishan', 'Chai table and board-game introductions', 'Gaming', 'jubilee', 'Friendly Turn Demo Table', day(2, 18), 2, ['arjun'], { capacity: 10, image: 'coffee', tags: ['board-games', 'chai', 'visiting-friends'], description: 'A fictional small-group chai and easy-game session, including a visiting friend from Bengaluru. We will teach two quick games and swap recommendations for meeting people in the city.' }),

    scene('delhi-photo', 'zoya', 'An eye for details: neighbourhood photo walk', 'Outdoor Activities', 'lodhi', 'Walk & Notice Demo Circle', day(weekendOffset, 8), 2, ['ved'], { capacity: 14, image: 'architecture', tags: ['photography', 'walking', 'all-levels'], description: 'Use a phone or camera to look for patterns, colour, and small stories on a leisurely neighbourhood walk. We will pause often and leave room for conversation.' }),
    scene('delhi-film-circle', 'ved', 'One film, many perspectives', 'Movie Screenings', 'hauzKhas', 'After Credits Demo Room', day(7, 18), 2.5, ['zoya'], { visibility: 'unlisted', capacity: 12, image: 'cinema', tags: ['invite-link', 'film-discussion', 'small-group'], description: 'An unlisted fictional film-discussion circle shared by invitation link. The sample gathering focuses on different readings of a story and respectful conversation after the screening.' }),
  ]

  const byKey = new Map(scenes.map((item) => [item.demoKey, item]))
  const post = (key, author, sceneKey, caption, mediaUrl, likes = []) => ({
    demoKey: key, author: `demo_${author}`, sceneKey, city: byKey.get(sceneKey).city,
    mediaType: 'image', mediaUrl: mediaUrl || byKey.get(sceneKey).image,
    caption: `${caption} Demo community post.`, likesUsernames: names(likes),
  })
  const posts = [
    post('breakfast-rohan', 'rohan', 'kochi-past-breakfast', 'Came for breakfast, left with a list of films and three new walking buddies. Thanks for making introductions, Aarav!', images.food, ['aarav', 'meera', 'farhan', 'devika']),
    post('breakfast-meera', 'meera', 'kochi-past-breakfast', 'My favourite part was everyone sharing a neighbourhood recommendation. Putting the next sketch morning on my calendar.', images.coffee, ['aarav', 'rohan', 'devika']),
    post('breakfast-aarav', 'aarav', 'kochi-past-breakfast', 'First time hosting a breakfast table and everyone made it easy. A small group really helps when people arrive on their own.', images.people, ['rohan', 'meera', 'farhan', 'devika']),
    post('coffee-rohan', 'rohan', 'kochi-coffee-now', 'The table has room for a few more. We are talking about favourite films and comparing coffee orders. Say hello when you arrive.', images.coffee, ['aarav', 'ananya']),
    post('coffee-farhan', 'farhan', 'kochi-coffee-now', 'We have already moved from movie recommendations to the best homemade snacks. This is my kind of afternoon.', images.food, ['rohan', 'aarav']),
    post('sketch-meera', 'meera', 'kochi-weekend-sketch', 'Packing pencils for the sketch morning. If you are worried about being a beginner, you are exactly the person I hoped would come.', images.art, ['aarav', 'ananya', 'kiran', 'lakshmi']),
    post('music-nila', 'nila', 'kochi-acoustic', 'Putting together a gentle acoustic set with room for conversations between songs. Excited to meet people coming to their first music circle.', images.music, ['aarav', 'joel', 'diya']),
    post('pottery-ananya', 'ananya', 'kochi-pottery', 'The first pinch pot is about learning how the clay feels, not making something perfect. We will keep the group small and explain each step.', images.art, ['meera', 'devika', 'aarav']),
    post('cleanup-devika', 'devika', 'kochi-cleanup', 'A little shared effort and a chai break afterwards. Looking forward to meeting neighbours who care about the places we all use.', images.people, ['aarav', 'rohan', 'lakshmi']),
    post('film-joel', 'joel', 'kochi-film-night', 'The best film-club moments happen in the discussion afterwards. Come with curiosity; there is no correct interpretation to memorise.', images.cinema, ['aarav', 'nila', 'meera']),
    post('bengaluru-riya', 'riya', 'bengaluru-coffee', 'Still learning my way around Bengaluru. Starting with a small coffee circle feels like a good way to turn unfamiliar faces into familiar ones.', images.coffee, ['arjun', 'sneha']),
    post('baking-sneha', 'sneha', 'bengaluru-bake', 'Bringing notes from my first loaf and the very wonky second attempt. If you have ever wondered why dough behaves like that, come compare notes.', images.baking, ['riya', 'arjun']),
    post('mumbai-kabir', 'kabir', 'mumbai-acoustic', 'A bass line, a simple melody, and a room that listens. Looking forward to a small acoustic evening with new faces.', images.music, ['tara', 'nila']),
    post('trivandrum-asha', 'asha', 'trivandrum-reading', 'The book you recommend does not have to be a classic. A story you loved is enough to start a conversation.', images.coffee, ['lakshmi', 'devika']),
    post('delhi-zoya', 'zoya', 'delhi-photo', 'Practising noticing: colours, shadows, signs, and the things we usually walk past. A phone camera is plenty for this walk.', images.architecture, ['ved', 'kiran']),
  ]

  const messages = []
  const thread = (sceneKey, exchanges) => {
    const event = byKey.get(sceneKey)
    const lastMessage = Math.min(reference.getTime() - 5 * minute, event.startsAt.getTime() - 15 * minute)
    exchanges.forEach(([sender, text], index) => {
      messages.push({
        demoKey: `${sceneKey}-chat-${index + 1}`, sceneKey, sender: `demo_${sender}`, text,
        createdAt: new Date(lastMessage - (exchanges.length - 1 - index) * 7 * minute),
      })
    })
  }
  thread('kochi-coffee-now', [
    ['rohan', 'Hi everyone! I have kept a couple of chairs together at the demo community table.'],
    ['aarav', 'Joining after a quick walk. Happy to meet some new people today.'],
    ['farhan', 'I will bring a few food recommendations to the conversation.'],
    ['ananya', 'First time joining one of these. Thanks for making it easy to say hello!'],
    ['rohan', 'Absolutely. We will do a round of introductions when you arrive.'],
  ])
  thread('kochi-weekend-sketch', [
    ['meera', 'A pencil and any notebook are enough. Please do not worry about having fancy materials.'],
    ['aarav', 'That helps! My sketchbook has been mostly empty for months.'],
    ['ananya', 'I am bringing a small watercolour kit and can share a few colours.'],
    ['kiran', 'I will bring water and a cap. Looking forward to noticing the details slowly.'],
    ['meera', 'We will start with tiny two-minute sketches, then take our time with one view.'],
  ])
  thread('kochi-acoustic', [
    ['nila', 'Welcome! The sample set is mostly acoustic and we will keep the room relaxed.'],
    ['joel', 'Coming with a couple of song recommendations if there is time to chat afterwards.'],
    ['diya', 'Happy to help with introductions before the first song.'],
    ['aarav', 'Looking forward to this. Is joining solo okay?'],
    ['nila', 'Definitely. Most people are arriving on their own, so we will make introductions.'],
  ])
  thread('kochi-badminton', [
    ['rohan', 'We will rotate partners and explain scoring before the first game. Beginners are welcome.'],
    ['aarav', 'I am very much a beginner, so the explanation will help.'],
    ['devika', 'Same here. Looking forward to a gentle warm-up first.'],
    ['kiran', 'I have a spare racket and can help explain the serve.'],
  ])
  thread('kochi-past-breakfast', [
    ['aarav', 'Welcome to the breakfast group! We will start with introductions and favourite neighbourhood spots.'],
    ['meera', 'Looking forward to it. I have a few sketch-walk recommendations.'],
    ['farhan', 'I will bring a recipe recommendation rather than a restaurant list for once.'],
    ['rohan', 'Count me in. I am coming on my own and happy to meet everyone.'],
  ])
  thread('bengaluru-coffee', [
    ['riya', 'I thought a small coffee circle would be a friendly place to start. What brought everyone to Bengaluru?'],
    ['arjun', 'Work first, then board games kept me here. Happy to share a few ways to find groups.'],
    ['sneha', 'I would love some company for weekend sketching too. Looking forward to meeting you both.'],
  ])
  thread('mumbai-acoustic', [
    ['kabir', 'Keeping the sample evening unplugged and conversational. Let me know if you have a favourite kind of acoustic music.'],
    ['tara', 'I am partial to songs that tell a good story. Excited to listen.'],
  ])
  thread('delhi-photo', [
    ['zoya', 'A phone camera is enough. We will pause often and try a few simple observation prompts.'],
    ['ved', 'That sounds ideal. I would like to get better at noticing things rather than taking fifty identical pictures.'],
  ])

  const friendships = [
    ['aarav-rohan', 'aarav', 'rohan', 'ACCEPTED'],
    ['aarav-meera', 'meera', 'aarav', 'ACCEPTED'],
    ['aarav-devika', 'aarav', 'devika', 'ACCEPTED'],
    ['aarav-ananya', 'ananya', 'aarav', 'PENDING'],
    ['aarav-kiran', 'kiran', 'aarav', 'PENDING'],
    ['meera-nila', 'meera', 'nila', 'ACCEPTED'],
    ['joel-farhan', 'joel', 'farhan', 'ACCEPTED'],
    ['lakshmi-asha', 'lakshmi', 'asha', 'ACCEPTED'],
    ['riya-arjun', 'riya', 'arjun', 'ACCEPTED'],
    ['riya-sneha', 'sneha', 'riya', 'ACCEPTED'],
    ['tara-kabir', 'tara', 'kabir', 'ACCEPTED'],
    ['zoya-ved', 'ved', 'zoya', 'ACCEPTED'],
  ].map(([demoKey, requester, recipient, status]) => ({
    demoKey, requester: `demo_${requester}`, recipient: `demo_${recipient}`, status,
  }))

  return { users, scenes, posts, messages, friendships }
}
