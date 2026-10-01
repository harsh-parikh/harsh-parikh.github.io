(function() {
  // ---------- Knowledge base ----------
  // Each entry has tiered keywords:
  //   strong  — distinctive terms that uniquely identify this topic (high weight)
  //   weak    — generic/related words that only count when reinforced (low weight)
  //   phrases — multi-word substrings of the raw query that signal strong intent
  // A chunk is only returned if it has SOME signal: a strong hit, a phrase hit,
  // a title hit, or at least 2 weak hits. This avoids matching on single generic
  // words like "class" or "course".
  var KB = [
    {
      id: 'deadlines',
      strong: ['deadline','deadlines','due','upcoming'],
      weak: ['next','soon','week','coming'],
      phrases: ['what is due','due next','due this week','due soon','coming up','upcoming deadline','upcoming deadlines','next deadline','what do i have due','anything due'],
      section: '#coming-up', title: 'What is due next',
      // Built at question time from the lecture calendar, so it never goes stale.
      answer: function() {
        var now = Date.now();
        var items = window.bis527Upcoming ? window.bis527Upcoming(now).slice(0, 5) : [];
        var row = window.bis527NextLecture ? window.bis527NextLecture(now) : null;
        var html = '';
        if (items.length) {
          html += '<p>Coming up:</p><ul>' + items.map(function(it) {
            var link = it.href ? ' (<a href="' + it.href + '"' + (/^https?:/.test(it.href) ? ' target="_blank" rel="noopener"' : '') + '>details</a>)' : '';
            return '<li><strong>' + it.when + '</strong>: ' + it.label + link + '</li>';
          }).join('') + '</ul>';
        } else {
          html += '<p>No class-wide deadlines are listed on this page right now. Check <a href="https://yale.instructure.com/courses/122186/assignments" target="_blank" rel="noopener">Canvas</a>.</p>';
        }
        if (row) html += '<p>Next class: <a href="#' + row.id + '">' + row.querySelector('.when-date').textContent + ', ' + row.querySelector('.when-lec').textContent + '</a>.</p>';
        return html + '<p>Scribe deadlines are in the <a href="#calendar">lecture calendar</a>. Canvas is the deadline of record.</p>';
      }
    },
    {
      id: 'files',
      strong: ['template','templates','download','downloads','file','files','tex','bib','example','examples'],
      weak: ['pdf','latex','scribe','solution','homework','where','find','get'],
      phrases: ['course files','where can i find','where do i get','scribe template','solution template','proposal template','example scribe','example note','download the','latex template'],
      section: '#materials', title: 'Course files',
      answer: '<p>All downloads are under <a href="#files">Course Files</a>:</p><ul><li>Homework 1: <a href="bis527/hw1-search-and-complexity.pdf">PDF</a> (was due Sat Sep 26)</li><li>Homework solution template: <a href="bis527/hw-solution-template.tex">.tex</a> · <a href="bis527/hw-solution-template.pdf">.pdf</a></li><li>Project proposal template: <a href="bis527/project-proposal-template.tex">.tex</a> · <a href="bis527/project-proposal-template.pdf">.pdf</a></li><li>Potential project ideas: <a href="bis527/bis527-project-ideas.pdf">PDF</a></li><li>Scribe template: <a href="bis527/scribe-template.tex">.tex</a> · <a href="bis527/scribe-template.pdf">.pdf</a> · <a href="bis527/scribe-refs.bib">.bib</a></li><li>Instructor example scribe notes: <a href="bis527/example-lec01-what-is-data-science.pdf">Lecture 1</a>, <a href="bis527/scribe-lec02-parikh.pdf">Lecture 2</a>, <a href="bis527/scribe-lec03-parikh.pdf">Lecture 3</a></li><li>Student scribe notes: next to each lecture in the <a href="#calendar">lecture calendar</a> (Lectures 3 and 4 so far)</li></ul><p>On Canvas only: <a href="https://yale.instructure.com/courses/122186/assignments" target="_blank" rel="noopener">scribe assignments</a> and the <a href="https://yale.instructure.com/courses/122186/files" target="_blank" rel="noopener">name-card template</a>.</p>'
    },
    {
      id: 'calendar',
      strong: ['recess','holiday','holidays','thanksgiving','break','breaks','cancelled','canceled','calendar'],
      weak: ['no','class','off','day','days','date','dates','first','last','end','ends','start','starts','october','november','december','today','next'],
      phrases: ['no class','days off','days are off','day off','is there class','do we have class','last day of class','first day of class','when does the course end','when does the class end','fall break','thanksgiving break','october recess','november recess','next class','which days'],
      section: '#schedule', title: 'Lecture calendar',
      answer: '<p>Classes run Tue/Thu from <strong>Thu Sep 3</strong> to <strong>Thu Dec 10</strong> (26 lectures). <strong>No class</strong> on Thu Oct 22 (October recess) and Tue Nov 24 / Thu Nov 26 (November recess), per the <a href="https://registrar.yale.edu/academic-calendars" target="_blank" rel="noopener">Yale academic calendar</a>. The next class is highlighted in the <a href="#calendar">lecture calendar</a> and shown under <a href="#coming-up">Coming up</a>; the calendar also gives each lecture&rsquo;s topic, reading, scribe notes, and deadlines.</p>'
    },
    {
      id: 'course-basics',
      strong: ['bis527','527','bis','overview','description'],
      weak: ['course','name','title','code','health','data','science'],
      phrases: ['what is this course','course name','course code','what course','tell me about the course','about this course'],
      section: '#about', title: 'About the course',
      answer: '<p>This is <strong>BIS 527: Introduction to Health Data Science</strong>, offered Fall 2026 by the Yale School of Public Health, Department of Biostatistics. It covers three modules: data structures &amp; algorithms, machine learning, and causal inference — with applications in public health.</p>'
    },
    {
      id: 'meeting-time',
      strong: ['meet','meeting','session','sessions'],
      weak: ['time','schedule','length','minutes','long','often','days','class','when','where','room','building','address','location'],
      phrases: ['class meeting','how long is the class','how often does','when does the class','class time','when is class','when do we meet','meeting time','where is class','where does the class meet','class location','where do we meet'],
      section: '#about', title: 'When the class meets',
      answer: '<p>The class meets <strong>Tuesdays and Thursdays, 3:00–4:20pm</strong>, in <strong>Winslow Auditorium (Room 109, LEPH), 60 College St</strong>.</p>'
    },
    {
      id: 'instructor',
      strong: ['instructor','professor','harsh','parikh','prof'],
      weak: ['teacher','email','contact','teach','teaches'],
      phrases: ['who is the instructor','who teaches','contact the instructor','email the instructor','who is teaching'],
      section: '#about', title: 'Instructor',
      answer: '<p>The instructor is <strong>Harsh Parikh, Ph.D.</strong>, Assistant Professor of Biostatistics. Email: <a href="mailto:harsh.parikh@yale.edu">harsh.parikh@yale.edu</a>.</p>'
    },
    {
      id: 'office-hours',
      strong: ['office','zoom'],
      weak: ['hours','room','location','help','available'],
      phrases: ['office hours','where are office hours','when are office hours','can i come to office'],
      section: '#about', title: 'Office hours',
      answer: '<p>The instructor holds office hours <strong>Thursdays, 10–11am</strong>, at <strong>60 College St, Room 200</strong>. TF office hours: Christopher Alvarez, <strong>Mondays 11am–1pm on Zoom</strong>. Swaha Bhattacharya, <strong>Fridays 1–2pm</strong>, hybrid: in person on the 11th floor of Kline Tower or on Zoom (<a href="https://yale.instructure.com/courses/122186/announcements" target="_blank" rel="noopener">link on Canvas</a>). Yukta Nagaraj, <strong>Tuesdays 2–3pm on Zoom</strong> (<a href="https://yale.instructure.com/courses/122186/announcements/857768" target="_blank" rel="noopener">link in her Canvas announcement</a>). Zoom links are posted in <a href="https://yale.instructure.com/courses/122186/announcements" target="_blank" rel="noopener">Canvas announcements</a>.</p>'
    },
    {
      id: 'tfs',
      strong: ['tf','tfs','fellow','fellows'],
      weak: ['ta','tas','teaching','assistant','assistants'],
      phrases: ['teaching fellow','teaching assistant','who are the tfs','contact a tf','contact the tf'],
      section: '#about', title: 'Teaching Fellows',
      answer: '<p>The Teaching Fellows are <strong>Christopher Alvarez</strong> (<a href="mailto:christopher.alvarez@yale.edu">christopher.alvarez@yale.edu</a>), <strong>Swaha Bhattacharya</strong> (<a href="mailto:swaha.bhattacharya@yale.edu">swaha.bhattacharya@yale.edu</a>), and <strong>Yukta Nagaraj</strong> (<a href="mailto:yukta.nagaraj@yale.edu">yukta.nagaraj@yale.edu</a>). They grade participation and quizzes. Office hours: Christopher Mondays 11am–1pm on Zoom, Swaha Fridays 1–2pm (hybrid: Kline Tower 11th floor or Zoom), Yukta Tuesdays 2–3pm on Zoom (<a href="https://yale.instructure.com/courses/122186/announcements/857768" target="_blank" rel="noopener">link on Canvas</a>). Zoom links are posted in <a href="https://yale.instructure.com/courses/122186/announcements" target="_blank" rel="noopener">Canvas announcements</a>.</p>'
    },
    {
      id: 'prereqs',
      strong: ['prerequisite','prerequisites','prereq','prereqs'],
      weak: ['requirement','requirements','background','required','knowledge'],
      phrases: ['prerequisites for','what do i need to know','prereqs','what background','what should i know before'],
      section: '#about', title: 'Prerequisites',
      answer: '<p>Foundational knowledge (or concurrent enrollment) in:</p><ul><li><strong>Linear algebra</strong> — vectors, matrices, basic operations</li><li><strong>Set theory</strong> — notation, union/intersection/complement</li><li><strong>Probability</strong> — random variables, distributions, Bayes’ rule</li><li><strong>Programming</strong> — any language; Python helpful but not required</li></ul>'
    },
    {
      id: 'who-should-take',
      strong: ['enroll','enrollment','enrolling'],
      weak: ['audience','mph','phd','ms','undergrad','undergraduate','graduate','student','students'],
      phrases: ['who should take','who can enroll','is this for me','who is this for','can i take this','am i allowed to take'],
      section: '#about', title: 'Who should enroll',
      answer: '<p>This course is <strong>required for MS/PhD students in Biostatistics</strong>. It is also appropriate for MPH students with a quantitative focus, advanced undergraduates (with permission), and Stats &amp; DS or CS graduate students.</p>'
    },
    {
      id: 'programming',
      strong: ['python','language','programming'],
      weak: ['r','code','coding','software','tool','tools','libraries','library','matlab','java'],
      phrases: ['programming language','what language','do i need python','software stack','what programming','what coding'],
      section: '#materials', title: 'Programming & software',
      answer: '<p>The course uses <strong>Python</strong>. The full stack: Python 3, NumPy, Pandas, Scikit-learn, PyTorch, Matplotlib, Seaborn, Jupyter, and Overleaf (LaTeX) for writing.</p>'
    },
    {
      id: 'textbooks',
      strong: ['textbook','textbooks','book','books','clrs','erickson','mcs'],
      weak: ['reading','readings','buy','purchase','resource','resources','read'],
      phrases: ['required textbook','do i need to buy','what books','what readings','what should i read','what to read','what do i read','reading for','readings for'],
      section: '#materials', title: 'Textbooks and readings',
      answer: '<p>There is <strong>no single required textbook</strong>, and all readings are free online. The <a href="#calendar">lecture calendar</a> lists the reading for each lecture, with links that open at the right page; ask me about a lecture by number, for example &ldquo;reading for Lecture 7&rdquo;.</p><ul><li><a href="https://mcube.lab.nycu.edu.tw/~cfung/docs/books/cormen2001algorithms.pdf" target="_blank" rel="noopener">CLRS — Introduction to Algorithms</a> (section numbers on this page refer to this 2nd edition)</li><li><a href="https://jeffe.cs.illinois.edu/teaching/algorithms/" target="_blank" rel="noopener">Erickson — Algorithms</a></li><li><a href="https://courses.csail.mit.edu/6.042/spring18/mcs.pdf" target="_blank" rel="noopener">MCS — Mathematics for Computer Science</a></li><li><a href="https://users.cs.duke.edu/~cynthia/teaching.html" target="_blank" rel="noopener">IAML — Intuition for the Algorithms of ML</a> (Rudin)</li><li><a href="https://www.statlearning.com" target="_blank" rel="noopener">ISLR</a></li><li><a href="https://arxiv.org/pdf/2305.18793" target="_blank" rel="noopener">FCCI — A First Course in Causal Inference</a> (Ding)</li><li><a href="https://mixtape.scunning.com/" target="_blank" rel="noopener">Causal Inference: The Mixtape</a></li><li><a href="https://jakevdp.github.io/PythonDataScienceHandbook/" target="_blank" rel="noopener">Python Data Science Handbook</a></li></ul>'
    },
    {
      id: 'modules',
      strong: ['module','modules'],
      weak: ['topic','topics','cover','covers','unit','units','part','parts'],
      phrases: ['what modules','course modules','what does the course cover','what topics are covered'],
      section: '#schedule', title: 'Modules',
      answer: '<p>The course has three modules, taught in this order:</p><ul><li><strong>M1:</strong> Data Structures &amp; Algorithms — algorithmic thinking, sorting, complexity, trees, graphs, dynamic programming</li><li><strong>M2:</strong> Machine Learning &amp; AI — statistical learning, linear methods, nonparametric methods, neural nets, clustering</li><li><strong>M3:</strong> Causal Inference — potential outcomes, DAGs, matching, weighting, difference-in-differences</li></ul><p>See the <a href="#plan">planned topic sequence</a> and the <a href="#calendar">lecture calendar</a>.</p>'
    },
    {
      id: 'objectives',
      strong: ['objective','objectives','goal','goals'],
      weak: ['outcome','outcomes','learn','learning'],
      phrases: ['learning objectives','what will i learn','course goals','course outcomes','what am i going to learn'],
      section: '#objectives', title: 'Learning objectives',
      answer: '<p>By the end of the course you will be able to: (1) <strong>formulate</strong> precise estimands from natural-language problems, (2) <strong>decompose</strong> complex problems into tractable sub-problems, (3) <strong>implement</strong> data science methods in Python, (4) <strong>interpret</strong> results in context, (5) <strong>communicate</strong> findings to varied audiences, and (6) <strong>evaluate</strong> the appropriateness of analytical approaches.</p>'
    },
    {
      id: 'weekly-schedule',
      strong: ['week','weekly','schedule','calendar','syllabus'],
      weak: ['lecture','lectures','topic','topics','covered','cover'],
      phrases: ['weekly schedule','lecture topics','what do we cover each week','class schedule','full schedule','covered so far','cover so far','what did we cover','what have we covered','what we covered','what was covered'],
      section: '#schedule', title: 'Lecture schedule',
      answer: '<p>26 lectures, Tue/Thu, from <strong>Thu Sep 3</strong> to <strong>Thu Dec 10</strong>. No class Oct 22 (October recess) or Nov 24 and Nov 26 (November recess). Covered so far: Lec 1 What is Data Science?; Lec 2 algorithmic thinking, recursion, and bubble sort; Lec 3 merge sort; Lec 4 computational complexity (O, &Omega;, &Theta;); Lec 5 graphs and breadth-first search; Lec 6 analysis of breadth-first search; Lec 7 designing a dynamic programming algorithm for the longest common subsequence, with and without memoization. Planned for Lec 8 (Tue Sep 29): analysis of that algorithm. Later topics are posted after each class. Each lecture&rsquo;s reading and scribe notes are in the <a href="#calendar">lecture calendar</a>; ask me about a lecture by number, for example &ldquo;Lecture 6&rdquo;.</p><p>Planned sequence: course intro; algorithms, sorting &amp; complexity; trees &amp; graphs; dynamic programming; statistical learning; linear methods; nonparametric methods; neural networks; clustering; potential outcomes &amp; DAGs; matching &amp; weighting; project presentations &amp; data equity. See the <a href="#plan">planned topic sequence</a>.</p>'
    },
    {
      id: 'grade-weights',
      strong: ['grade','grades','grading','breakdown','percent','percentage'],
      weak: ['weight','weights','worth','count','evaluation','assessment','assessments','components'],
      phrases: ['grade breakdown','how is the grade','grading scheme','how much is worth','final grade','how am i graded'],
      section: '#assessments', title: 'Grade breakdown',
      answer: '<p>Your final grade is composed of:</p><ul><li><strong>36%</strong> — Homework Assignments (4 total, 9% each)</li><li><strong>30%</strong> — Course Project</li><li><strong>18%</strong> — Scribe Notes (2 total, 9% each)</li><li><strong>11%</strong> — In-Class Quizzes</li><li><strong>5%</strong> — Participation</li></ul>'
    },
    {
      id: 'grade-scale',
      strong: ['honors','cutoff','cutoffs','scale'],
      weak: ['pass','fail','hp','letter','threshold','ysph','passing'],
      phrases: ['grading scale','letter grade','cutoff for honors','what is honors','passing grade','what counts as honors'],
      section: '#assessments', title: 'Grading scale',
      answer: '<p>YSPH uses Honors / High Pass / Pass / Fail:</p><ul><li><strong>≥ 90%</strong> — Honors (H)</li><li><strong>80–89%</strong> — High Pass (HP)</li><li><strong>65–79%</strong> — Pass (P)</li><li><strong>&lt; 65%</strong> — Fail (F)</li></ul>'
    },
    {
      id: 'homework',
      strong: ['homework','hw'],
      weak: ['assignment','assignments','problem','problems','pset','psets','due','dates','release','released','deadline'],
      phrases: ['how many homework','homework due','when is hw','homework schedule','when are assignments','homework deadline'],
      section: '#assessments', title: 'Homework',
      answer: '<p>There are <strong>4 homework assignments</strong>, each worth 9% (36% total). They are <strong>graded on completion, not correctness</strong>: a genuine attempt with reasoning shown earns full credit, and you still get written feedback. Submit three files on <a href="https://yale.instructure.com/courses/122186/assignments" target="_blank" rel="noopener">Canvas</a> (.pdf, .tex, .py) using the solution template (<a href="bis527/hw-solution-template.tex">.tex</a> · <a href="bis527/hw-solution-template.pdf">.pdf</a>); no handwritten work.</p><ul><li><strong>HW 1:</strong> was due Sat Sep 26, 11:59pm (<a href="bis527/hw1-search-and-complexity.pdf">PDF</a>)</li><li><strong>HW 2:</strong> due <strong>Sat Oct 17</strong> (see <a href="https://yale.instructure.com/courses/122186/assignments" target="_blank" rel="noopener">Canvas</a>)</li><li><strong>HW 3:</strong> planned: out week 8, due week 10 (Nov 2&ndash;6)</li><li><strong>HW 4:</strong> planned: out week 10, due week 12 (Nov 16&ndash;20)</li></ul>'
    },
    {
      id: 'project',
      strong: ['project','capstone','proposal','proposals'],
      weak: ['team','teams','group','groups','poster','presentation','presentations','present'],
      phrases: ['course project','group project','team project','final project','project deliverable','project deliverables','what is the project','project proposal','proposal presentation'],
      section: '#assessments', title: 'Course project',
      answer: '<p>The course project is <strong>team-based (4–5 students)</strong> and worth 30%. Teams were set on Fri Sep 18.</p><ul><li><strong>Proposal:</strong> due <strong>Tue Sep 29, 11:59pm</strong>. One to two pages: your question and why it matters, the dataset and how you will access it, a tentative analysis plan with a way to evaluate the results, and a timeline with each member&rsquo;s responsibilities. No results are expected yet. Template: <a href="bis527/project-proposal-template.tex">.tex</a> · <a href="bis527/project-proposal-template.pdf">.pdf</a>. <a href="https://yale.instructure.com/courses/122186/announcements/862110" target="_blank" rel="noopener">Details on Canvas</a>.</li><li><strong>Proposal presentations:</strong> Thu Oct 1, in class. One speaker per team, five minutes.</li><li><strong>Mid-point check-in:</strong> week 8 (Oct 19&ndash;23)</li><li><strong>Poster session:</strong> week 12 (Nov 16&ndash;20), in class</li><li><strong>Final report:</strong> finals week</li></ul><p>See the <a href="bis527/bis527-project-ideas.pdf">potential project ideas</a> (PDF); your own idea is welcome.</p>'
    },
    {
      id: 'scribe',
      strong: ['scribe','scribes'],
      weak: ['note','notes','latex','deadline','deadlines'],
      phrases: ['scribe notes','what are scribe','what is a scribe','scribing'],
      section: '#assessments', title: 'Scribe notes',
      answer: '<p>Each student scribes 2 lectures (9% each, 18% total). Assignments are on Canvas and change only for reasons such as illness. A scribe note is a self-contained chapter on the lecture topic, with references, that goes beyond what was covered in class; it becomes a shared resource for everyone. Use the LaTeX template (<a href="bis527/scribe-template.tex">.tex</a> · <a href="bis527/scribe-template.pdf">.pdf</a> · <a href="bis527/scribe-refs.bib">.bib</a>) and read the example notes for <a href="bis527/example-lec01-what-is-data-science.pdf">Lecture 1</a>, <a href="bis527/scribe-lec02-parikh.pdf">Lecture 2</a> and <a href="bis527/scribe-lec03-parikh.pdf">Lecture 3</a>. Submit both .tex and .pdf on <a href="https://yale.instructure.com/courses/122186/assignments" target="_blank" rel="noopener">Canvas</a>. Per-lecture deadlines, and the graded student notes for each lecture, are in the <a href="#calendar">lecture calendar</a>.</p>'
    },
    {
      id: 'quizzes',
      strong: ['quiz','quizzes','exam','exams','midterm'],
      weak: ['test','tests','final'],
      phrases: ['in-class quiz','how many quizzes','are there exams','is there a final exam','is there a midterm','final exam'],
      section: '#assessments', title: 'Quizzes & exams',
      answer: '<p><strong>Every class from Lecture 2</strong> has a short paper quiz at a random time; hand it to a TF before you leave (11% total). No make-ups. There are <strong>no traditional midterm or final exams</strong> — the course project takes that role. <strong>No AI or devices on quizzes.</strong></p>'
    },
    {
      id: 'participation',
      strong: ['participation','participate'],
      weak: ['engagement','engage','forum','discussion'],
      phrases: ['class participation','how is participation graded','participation grade'],
      section: '#assessments', title: 'Participation',
      answer: '<p>Participation is worth <strong>5%</strong> and is scored by the TFs in every class: <strong>5</strong> for substantive participation (guiding discussion, volunteering, reasoning through an answer, raising an objection, working at the board), <strong>2.5</strong> for minimal engagement, <strong>0</strong> for none or absent. The term score is the average with the two lowest dropped. Bring your name card (template in <a href="https://yale.instructure.com/courses/122186/files" target="_blank" rel="noopener">Canvas Files</a>); scores are recorded by name, and the term score is posted at the end of the course. The scribe for a lecture is recorded as fully participating. If speaking in class is a barrier, <a href="mailto:harsh.parikh@yale.edu?subject=BIS%20527%20participation">email the instructor</a> in the first two weeks.</p>'
    },
    {
      id: 'attendance',
      strong: ['attendance','attend','attending','attended','absent','absence','absences','skip','skipping','skipped'],
      weak: ['miss','missing','present','show','come','lecture','class','mandatory','required'],
      phrases: ['can i skip','do i need to attend','attendance policy','miss class','skip class','skip lecture','miss a lecture','need to come','need to be in class','have to come to class','do i have to attend','is attendance required','is class mandatory'],
      section: '#assessments', title: 'Attendance',
      answer: '<p><strong>Attendance is mandatory.</strong> Two parts of your grade happen in every class and cannot be made up:</p><ul><li><strong>Participation (5%)</strong> is scored in every class; an absence scores 0 (the two lowest scores are dropped).</li><li><strong>In-class quizzes (11%)</strong> happen during lectures and cannot be made up.</li><li><strong>Electronic devices are not permitted during lectures</strong>, so the course is structured around being present and engaged.</li></ul><p>For documented emergencies or other circumstances, contact the instructor in advance.</p>'
    },
    {
      id: 'late-policy',
      strong: ['late','extension','extensions'],
      weak: ['deadline','miss','missed','emergency','submit'],
      phrases: ['late policy','late submission','can i turn in late','extension request','miss a deadline','submit late'],
      section: '#assessments', title: 'Late policy',
      answer: '<p>Late submissions are <strong>not accepted</strong>. If you have a documented emergency, contact the instructor <em>before</em> the deadline to discuss.</p>'
    },
    {
      id: 'turnaround',
      strong: ['turnaround','feedback'],
      weak: ['graded','return','returned','back','timeline'],
      phrases: ['grading turnaround','when will i get my grade','feedback timeline','when do we get grades','how soon do we get'],
      section: '#assessments', title: 'Grading turnaround',
      answer: '<p>Homework and scribe notes are graded and returned within <strong>1 week</strong>. The participation score is recorded every class and posted at the end of the course.</p>'
    },
    {
      id: 'ai-policy',
      strong: ['ai','chatgpt','claude','copilot','llm','gpt','gemini'],
      weak: ['tool','tools','allowed','permitted','disclose','disclosure','using','use'],
      phrases: ['can i use ai','ai policy','is chatgpt allowed','use copilot','ai tools','large language model','am i allowed to use ai','is ai allowed','ai for homework','ai for assignments','use ai for','use ai on','ai allowed for','is ai permitted','allowed for assignments','allowed for homework'],
      section: '#policies', title: 'AI policy',
      answer: '<p>AI assistants (ChatGPT, Claude, Copilot, etc.) are <strong>permitted as learning aids</strong> for homework and scribe notes — with conditions:</p><ul><li>You must <strong>understand</strong> everything you submit</li><li>You must <strong>declare</strong> all AI use at the top of the submission: the tool, what it did, what you verified, and what you did not. An undeclared use, or an inaccuracy traced to AI, scores zero</li><li>You own all accuracy — AI hallucinations are your responsibility</li><li><strong>No AI on quizzes.</strong></li></ul>'
    },
    {
      id: 'collaboration',
      strong: ['collaborate','collaboration','collaborating'],
      weak: ['work','together','classmate','classmates','discuss','share','sharing','partner'],
      phrases: ['can i work together','collaborate with classmates','discuss homework','work with others','can i share','work with a partner','study group'],
      section: '#policies', title: 'Collaboration policy',
      answer: '<p>Discussion with classmates is <strong>encouraged</strong>, but:</p><ul><li>All <strong>written solutions must be your own</strong></li><li>All <strong>code must be written individually</strong></li><li><strong>Acknowledge</strong> all collaborators and resources</li><li>Do not share answers, code, or LaTeX files</li></ul>'
    },
    {
      id: 'devices',
      strong: ['laptop','laptops','phone','phones','ipad','tablet','device','devices','electronic'],
      weak: ['computer','computers','screen','handwritten'],
      phrases: ['can i bring my laptop','are laptops allowed','phones in class','take notes on laptop','use my laptop','use my phone'],
      section: '#policies', title: 'Electronic devices',
      answer: '<p>Mobile phones, iPads, and laptops are <strong>not permitted during lectures</strong> without prior permission; take notes on paper. Unauthorized use can zero your participation grade for the whole semester. Permission is automatic with a Student Accessibility Services accommodation: email the instructor. <strong>No devices during quizzes</strong> under any circumstances.</p>'
    },
    {
      id: 'integrity',
      strong: ['integrity','plagiarism','plagiarize','cheat','cheating','capi'],
      weak: ['honor','misconduct','violation','violations','fabrication'],
      phrases: ['academic integrity','honor code','plagiarism policy','what happens if i cheat','academic dishonesty'],
      section: '#policies', title: 'Academic integrity',
      answer: '<p>All students must follow the YSPH <strong>Code of Academic and Professional Integrity (CAPI)</strong>. Violations — plagiarism, unauthorized collaboration, undisclosed AI use, fabrication — are referred to the CAPI Committee. Penalties can include expulsion. The code is in the <a href="https://ysph.yale.edu/myysph/" target="_blank" rel="noopener">YSPH student portal</a>.</p>'
    },
    {
      id: 'canvas',
      strong: ['canvas','lms'],
      weak: ['platform','login'],
      phrases: ['where is canvas','canvas link','canvas page','log in to canvas'],
      section: '#about', title: 'Canvas',
      answer: '<p>The course Canvas page is <a href="https://yale.instructure.com/courses/122186" target="_blank" rel="noopener">BIS 527 01 (FA26)</a> on yale.instructure.com; log in with your Yale NetID. Useful pages: <a href="https://yale.instructure.com/courses/122186/assignments" target="_blank" rel="noopener">Assignments</a> (homework, scribe notes by lecture), <a href="https://yale.instructure.com/courses/122186/announcements" target="_blank" rel="noopener">Announcements</a> (TF office hours), <a href="https://yale.instructure.com/courses/122186/files" target="_blank" rel="noopener">Files</a> (name-card template), <a href="https://yale.instructure.com/courses/122186/grades" target="_blank" rel="noopener">Grades</a>.</p>'
    },
    {
      id: 'website',
      strong: ['website','site','github'],
      weak: ['web','page','link','url'],
      phrases: ['course website','where is the website','class website','where can i find the syllabus'],
      section: '#about', title: 'Course website',
      answer: '<p>The course website is <a href="https://harsh-parikh.github.io/intro_ds_2026">harsh-parikh.github.io/intro_ds_2026</a>. Downloads (templates, example scribe notes, homework PDFs) are under <a href="#files">Course Files</a>; everything you submit goes to <a href="https://yale.instructure.com/courses/122186" target="_blank" rel="noopener">Canvas</a>.</p>'
    },
    {
      id: 'accessibility',
      strong: ['accessibility','accommodation','accommodations','disability','sas'],
      weak: ['accessible','services'],
      phrases: ['disability services','request accommodations','student accessibility','i have a disability'],
      section: '#resources', title: 'Accessibility',
      answer: '<p><a href="https://sas.yale.edu/" target="_blank" rel="noopener">Yale Student Accessibility Services (SAS)</a>: email <a href="mailto:sas@yale.edu">sas@yale.edu</a> or call <strong>203-432-2324</strong>. An SAS accommodation automatically permits device use in class; just email the instructor.</p>'
    },
    {
      id: 'mental-health',
      strong: ['mental','wellness','counselor','counseling','therapy','crisis','988','overwhelmed'],
      weak: ['stress','anxiety','depression','support','help','struggling'],
      phrases: ['mental health','wellness counselor','crisis hotline','i feel overwhelmed','i need help','i am struggling','feeling stressed'],
      section: '#resources', title: 'Mental health',
      answer: '<p>YSPH Wellness Counselor: <a href="mailto:diane.frankel-gramelis@yale.edu">Diane Frankel-Gramelis</a>. For crisis support, dial <strong>988</strong> (<a href="https://988lifeline.org/" target="_blank" rel="noopener">24/7 Suicide &amp; Crisis Lifeline</a>).</p>'
    },
    {
      id: 'writing',
      strong: ['writing'],
      weak: ['lab','consult','consultation','paper','essay','draft','editing'],
      phrases: ['writing support','graduate writing lab','help with writing','writing center'],
      section: '#resources', title: 'Writing support',
      answer: '<p>The <a href="https://poorvucenter.yale.edu/writing/graduate-writing-lab" target="_blank" rel="noopener">Yale Graduate Writing Lab</a> offers free consultations. Book at <a href="https://yale.mywconline.net" target="_blank" rel="noopener">yale.mywconline.net</a>.</p>'
    },
    {
      id: 'title-ix',
      strong: ['title','ix','oiea'],
      weak: ['harassment','discrimination','sexual','misconduct'],
      phrases: ['title ix','sexual harassment','title nine','report harassment'],
      section: '#resources', title: 'Title IX',
      answer: '<p>Deputy Title IX Coordinator: <a href="mailto:kelly.shay@yale.edu">Kelly Shay</a>. More info at the <a href="https://oiea.yale.edu/" target="_blank" rel="noopener">Office of Institutional Equity &amp; Accessibility</a>.</p>'
    },
    {
      id: 'inclusivity',
      strong: ['inclusivity','inclusion','diversity'],
      weak: ['inclusive','community','equity','belonging'],
      phrases: ['diversity and inclusion','community of practice','feel included','dei'],
      section: '#resources', title: 'Inclusivity',
      answer: '<p>Office of Community &amp; Practice: contact <a href="mailto:mayur.desai@yale.edu">Mayur Desai</a> or <a href="mailto:randi.mccray@yale.edu">Randi McCray</a>.</p>'
    },
    {
      id: 'safety',
      strong: ['safety','evacuation','preparedness'],
      weak: ['emergency','fire','classroom'],
      phrases: ['classroom safety','in case of emergency','what to do in emergency','fire alarm'],
      section: '#resources', title: 'Classroom safety',
      answer: '<p>See <a href="https://emergency.yale.edu" target="_blank" rel="noopener">emergency.yale.edu</a> and the <a href="https://emergency.yale.edu/be-prepared/classroom-preparedness" target="_blank" rel="noopener">Classroom Preparedness</a> guide.</p>'
    }
  ];

  var STOPWORDS = new Set(['a','an','the','is','are','was','were','be','been','being','do','does','did','have','has','had','of','in','on','at','for','to','from','by','with','about','as','this','that','these','those','i','im','ive','you','your','we','they','my','our','their','it','its','me','please','tell','want','know','need','can','could','will','would','should','shall','may','might','must','and','or','but','if','then','so','than','there','here','any','some','what','when','where','how','why','who','which'])

  // Multi-word and brand-name synonyms applied to the raw query string first.
  // Brand-name expansions (chatgpt -> ai, etc.) must happen here, not in
  // WORD_SYNS, so that phrase substrings like "can i use ai" can match a
  // query that mentions "chatgpt".
  var PHRASE_SYNS = [
    [/chatgpts?/g, 'ai'],
    [/copilots?/g, 'ai'],
    [/\bclaude\b/g, 'ai'],
    [/\bgpts?\b/g, 'ai'],
    [/\bllms?\b/g, 'ai'],
    [/\bgemini\b/g, 'ai'],
    [/\bbard\b/g, 'ai'],
    [/large\s+language\s+models?/g, 'ai'],
    [/lang\.?\s*models?/g, 'ai'],
    [/problem\s+sets?/g, 'homework'],
    [/p\s*sets?/g, 'homework'],
    [/letter\s+grade/g, 'grading scale'],
    [/honor\s+code/g, 'academic integrity'],
    [/team\s+project/g, 'project'],
    [/group\s+project/g, 'project'],
    [/final\s+project/g, 'project'],
    [/finals?\s+week/g, 'project'],
    [/office\s*hours?/g, 'office hours'],
    [/teaching\s+fellows?/g, 'tf'],
    [/teaching\s+assistants?/g, 'tf'],
    [/what\s*'?\s*s\s+due/g, 'what is due'],
    [/grad\s+student/g, 'graduate student']
  ];

  // Single-word synonyms applied after tokenization. Only true synonyms —
  // never map one ordinary verb to another distinct concept (that's what
  // broke "can I use chatgpt" earlier: `use -> allowed -> permitted`).
  var WORD_SYNS = {
    'hw': 'homework', 'pset': 'homework', 'psets': 'homework',
    'assignment': 'homework', 'assignments': 'homework',
    'prof': 'instructor', 'professor': 'instructor', 'teacher': 'instructor',
    'pct': 'percentage', 'percent': 'percentage', 'percents': 'percentage', 'percentages': 'percentage',
    'ta': 'tf', 'tas': 'tf', 'fellows': 'tf', 'fellow': 'tf',
    'modules': 'module', 'topics': 'topic',
    'textbooks': 'textbook', 'books': 'book', 'readings': 'reading',
    'lectures': 'lecture', 'classes': 'class', 'sessions': 'session',
    'graded': 'grading', 'grades': 'grading',
    'deadlines': 'deadline', 'dates': 'deadline', 'due': 'deadline',
    'plagiarize': 'plagiarism', 'cheat': 'cheating', 'cheating': 'plagiarism'
  };

  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function applyPhraseSyns(s) {
    PHRASE_SYNS.forEach(function(pair) { s = s.replace(pair[0], pair[1]); });
    return s;
  }

  function tokenize(text) {
    var norm = applyPhraseSyns(normalize(text));
    return norm.split(' ')
      .filter(function(t) { return t.length > 0 && !STOPWORDS.has(t); })
      .map(function(t) { return WORD_SYNS[t] || t; });
  }

  // Tiered scoring: a chunk only matches if it has REAL signal — at least one
  // strong-keyword hit, one phrase match, one title-word match, or two weak hits.
  // This prevents single generic words ("class", "course") from triggering the
  // wrong topic.
  function score(qTokens, qStr, chunk) {
    var s = 0;
    var strongHits = 0, weakHits = 0, phraseHits = 0, titleHits = 0;
    var seen = new Set();

    var strongSet = new Set((chunk.strong || []).map(function(k) { return WORD_SYNS[k] || k; }));
    var weakSet   = new Set((chunk.weak   || []).map(function(k) { return WORD_SYNS[k] || k; }));

    qTokens.forEach(function(t) {
      if (seen.has(t)) return;
      seen.add(t);
      if (strongSet.has(t)) { s += 3; strongHits++; }
      else if (weakSet.has(t)) { s += 0.8; weakHits++; }
    });

    (chunk.phrases || []).forEach(function(p) {
      if (qStr.indexOf(p) !== -1) { s += 5; phraseHits++; }
    });

    normalize(chunk.title).split(' ').forEach(function(tw) {
      if (tw.length > 3 && !STOPWORDS.has(tw) && qTokens.indexOf(tw) !== -1) {
        s += 1.5; titleHits++;
      }
    });

    var hasSignal = strongHits > 0 || phraseHits > 0 || titleHits > 0 || weakHits >= 2;
    return { score: s, hasSignal: hasSignal };
  }

  function findMatches(query) {
    var qStr = applyPhraseSyns(normalize(query));
    var qTokens = tokenize(query);
    if (qTokens.length === 0) return [];
    var scored = KB.map(function(c) {
      var r = score(qTokens, qStr, c);
      return { chunk: c, s: r.score, hasSignal: r.hasSignal };
    });
    scored = scored.filter(function(x) { return x.hasSignal && x.s >= 2.5; });
    scored.sort(function(a, b) { return b.s - a.s; });
    return scored.slice(0, 2);
  }

  var SECTION_NAMES = {
    '#coming-up': 'Coming Up',
    '#about': 'About',
    '#objectives': 'Learning Objectives',
    '#schedule': 'Schedule',
    '#assessments': 'Assessments',
    '#materials': 'Materials',
    '#policies': 'Policies',
    '#resources': 'Resources'
  };

  // ---------- UI wiring ----------
  var fab = document.getElementById('chat-fab');
  var panel = document.getElementById('chat-panel');
  var closeBtn = document.getElementById('chat-close');
  var messages = document.getElementById('chat-messages');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var greeted = false;

  function openChat() {
    panel.classList.add('open');
    fab.setAttribute('aria-expanded', 'true');
    if (!greeted) { greeted = true; greet(); }
    setTimeout(function() { input.focus(); }, 180);
  }
  function closeChat() {
    panel.classList.remove('open');
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  }
  fab.addEventListener('click', function() {
    if (panel.classList.contains('open')) closeChat(); else openChat();
  });
  closeBtn.addEventListener('click', closeChat);
  panel.addEventListener('click', function (event) {
    var link = event.target.closest('a[href^="#"]');
    if (link) closeChat();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && panel.classList.contains('open')) closeChat();
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    input.value = '';
    addUserMessage(q);
    setTimeout(function() { respond(q); }, 250);
  });

  function addUserMessage(text) {
    var div = document.createElement('div');
    div.className = 'chat-msg user';
    div.textContent = text;
    messages.appendChild(div);
    scrollDown();
  }

  function addBotMessage(html) {
    var div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.innerHTML = html;
    if (window.markNewTabLinks) window.markNewTabLinks(div);
    messages.appendChild(div);
    scrollDown();
    return div;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'chat-typing';
    div.id = 'chat-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(div);
    scrollDown();
  }

  function hideTyping() {
    var t = document.getElementById('chat-typing-indicator');
    if (t) t.remove();
  }

  function scrollDown() { messages.scrollTop = messages.scrollHeight; }

  function sourceFooter(section) {
    var name = SECTION_NAMES[section] || 'Syllabus';
    return '<div class="source-link">Source: <a href="' + section + '">' + name + ' →</a></div>';
  }

  function greet() {
    addBotMessage('<p>Look up grading, deadlines, policies, and readings from the BIS 527 syllabus. Answers link to the relevant course section. Check Canvas for the latest announcements and deadlines.</p>');
    var suggestions = [
      "What's due next?",
      "What is the reading for Lecture 7?",
      "When are office hours?",
      "Can I use ChatGPT for homework?",
      "What's the grade breakdown?"
    ];
    var wrap = document.createElement('div');
    wrap.className = 'chat-suggestions';
    suggestions.forEach(function(s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-suggestion';
      btn.textContent = s;
      btn.addEventListener('click', function() {
        addUserMessage(s);
        wrap.remove();
        setTimeout(function() { respond(s); }, 200);
      });
      wrap.appendChild(btn);
    });
    messages.appendChild(wrap);
    scrollDown();
  }

  function answerOf(chunk) {
    return typeof chunk.answer === 'function' ? chunk.answer() : chunk.answer;
  }

  // "Lecture 6", "lec 6" or "class 6": answer from that row of the lecture calendar.
  function lectureAnswer(query) {
    var m = /\b(?:lecture|lec|class)\s*#?\s*(\d{1,2})\b/i.exec(query);
    if (!m) return null;
    var num = parseInt(m[1], 10);
    var row = document.getElementById('lec-' + num);
    if (!row) return null;
    var topicCell = row.querySelector('td.topic');
    var html = '<p><strong>Lecture ' + num + '</strong>, ' + row.querySelector('.when-date').textContent + ': ' +
      (topicCell.classList.contains('tba') ? 'the topic is posted after class.' : topicCell.innerHTML + '.') + '</p>';
    ['reading', 'scribe', 'due'].forEach(function(cls) {
      var cell = row.querySelector('td.' + cls);
      if (!cell || !cell.textContent.trim()) return;
      var clone = cell.cloneNode(true);
      var label = clone.querySelector('.cell-label');
      var name = label ? label.textContent : '';
      if (label) label.remove();
      clone.querySelectorAll('.past-tag').forEach(function(t) { t.textContent = ' (past)'; t.className = 'dim'; });
      html += '<p><strong>' + name + '</strong></p>' + clone.innerHTML;
    });
    return html + '<div class="source-link">Source: <a href="#' + row.id + '">Lecture calendar →</a></div>';
  }

  function respond(query) {
    showTyping();
    setTimeout(function() {
      hideTyping();
      var lec = lectureAnswer(query);
      if (lec) { addBotMessage(lec); return; }
      var matches = findMatches(query);
      if (matches.length === 0) {
        addBotMessage('<p>I couldn’t find an answer to that in the syllabus. Please email the instructor at <a href="mailto:harsh.parikh@yale.edu?subject=BIS%20527%20Question">harsh.parikh@yale.edu</a> or ask during office hours.</p>');
        return;
      }
      var top = matches[0];
      addBotMessage(answerOf(top.chunk) + sourceFooter(top.chunk.section));

      // Include a second match only if it is clearly also relevant.
      if (matches.length > 1 && matches[1].s >= Math.max(3, top.s * 0.65) && matches[1].chunk.id !== top.chunk.id) {
        var second = matches[1].chunk;
        setTimeout(function() {
          addBotMessage('<p class="related">Related</p>' + answerOf(second) + sourceFooter(second.section));
        }, 300);
      }
    }, 380);
  }
})();
