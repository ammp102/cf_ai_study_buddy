# CF_AI_STUDY_BUDDY

## Summary

This project was developed as part of my application to summer internships at Cloudflare. <br>
It consists of an AI agent designed to help students learn, comprehend and memorize any topic and program their work.
This can be done by inquiring the agent on the topic/subject, asking it to generate flashcards and quizzes or scheduling breaks and starts.

## Implementation

Cloudflare agents starter was the base for this project. It was further expanded by completely shifting the purpose of the agent to a study dedicated one. It maintains the ability to use tools, scheduling ones were kept, the other default tools were removed. <br> 
Two new tools were added, responsible for saving quizzes and flashcards as durable objects, this allowed to tackle two different checkpoints at once, due to time limitations and increasing the complexity of the work. <br>
Changes were also made to the frontend that now includes a tab for the generated quizzes and flashcards, it is dinamic and allows for the answers and definitions to be shown only when desired. This provides another layer of interaction with durable objects.