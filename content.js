/* OpenHeart — site content.

   This is the file to edit when you want to change what the site says.
   Nothing here is code you need to understand: it is a list of entries.

   Rules for editing:
     - Keep the quotes ' ' around text, and the commas between entries.
     - To add an entry, copy an existing block from { to } and change the text.
     - draft: true  means "not confirmed yet". The site shows the entry with a
       "still being confirmed" note instead of presenting it as final.
       Change it to draft: false once the details are confirmed.
     - Leave a field as '' (empty) if you don't have it yet. The site will say
       so plainly rather than making something up. */

window.OH_CONTENT = {

  /* ================================================================
     ACCESS / FIND CARE — vetted clinics and sliding-scale options.
     Shown on the Find Care page, above the live ZIP-code search.
     ================================================================ */
  clinics: [
    {
      name: 'CrossOver Healthcare Ministry',
      anchor: true,          // anchor: true marks our main referral partner
      draft: true,           // set to false once Prajwal confirms the details
      what: 'Our anchor referral partner in Richmond. Primary care, blood pressure and cholesterol management, and help paying for medication, for people who are uninsured or on a low income.',
      where: 'Richmond, VA',
      phone: '',
      site: 'https://crossoverministry.org',
      hours: '',
      cost: 'Sliding scale based on income.',
      expect: ''
    }

    /* To add a clinic, copy the block below, paste it after the comma above,
       and remove the surrounding slash-stars.

    ,{
      name: 'Clinic name',
      anchor: false,
      draft: true,
      what: 'One or two sentences on what they do.',
      where: 'Street address, Richmond, VA',
      phone: '804-555-0100',
      site: 'https://example.org',
      hours: 'Mon to Fri, 9am to 5pm',
      cost: 'Sliding scale based on income. No one is turned away.',
      expect: 'What happens at the visit, in plain words.'
    }
    */
  ],

  /* ================================================================
     EDUCATION — the resource library.
     Add an article by copying a block. body is a list of paragraphs.
     es: is the Spanish version, and is optional. Leave it out if you
     don't have one yet.
     ================================================================ */
  resources: [
    {
      draft: false,
      title: 'What your blood pressure numbers mean',
      summary: 'Your reading has two numbers, like 120/80. Here is what each one is telling you.',
      body: [
        'The top number is the pressure in your arteries when your heart beats. The bottom number is the pressure between beats, when your heart is resting. Both matter.',
        'Under 120/80 is healthy. Between 120 and 139 on top, or 80 to 89 on the bottom, is elevated: nothing to panic about, but worth paying attention to. 140 or higher on top, or 90 or higher on the bottom, is high blood pressure, and it is worth talking to a doctor.',
        'A reading of 180/120 or higher needs care the same day.',
        'One high reading is not a diagnosis. Blood pressure moves around during the day, and it goes up when you are stressed, in a hurry, or have just had coffee. What matters is the pattern across several readings on different days.',
        'Most people with high blood pressure feel completely fine. That is why it is called the silent killer, and why checking is the only way to know.'
      ],
      es: {
        title: 'Qué significan sus números de presión arterial',
        summary: 'Su lectura tiene dos números, como 120/80. Esto es lo que le dice cada uno.',
        body: [
          'El número de arriba es la presión en sus arterias cuando su corazón late. El número de abajo es la presión entre latidos, cuando su corazón descansa. Los dos importan.',
          'Menos de 120/80 es saludable. Entre 120 y 139 arriba, o entre 80 y 89 abajo, es elevada: no es para alarmarse, pero sí para prestar atención. 140 o más arriba, o 90 o más abajo, es presión alta, y vale la pena hablar con un médico.',
          'Una lectura de 180/120 o más necesita atención el mismo día.',
          'Una sola lectura alta no es un diagnóstico. La presión cambia durante el día, y sube cuando uno está estresado, con prisa, o acaba de tomar café. Lo que importa es el patrón de varias lecturas en días diferentes.',
          'La mayoría de las personas con presión alta se sienten perfectamente bien. Por eso se le llama el asesino silencioso, y por eso medirse es la única manera de saber.'
        ]
      }
    },
    {
      draft: true,
      title: 'Small steps that protect your heart',
      summary: 'What actually moves the needle, on a real schedule and a real budget.',
      body: []
    },
    {
      draft: true,
      title: 'When to see a doctor',
      summary: 'Which signs can wait for an appointment, and which ones cannot wait at all.',
      body: []
    },
    {
      draft: true,
      title: 'What to expect at a clinic visit',
      summary: 'Who you will meet, what they will ask, what it costs, and what to bring.',
      body: []
    }
  ]
};
