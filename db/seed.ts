import { db } from "./index"
import {
  users,
  userAuth,
  schoolYears,
  semesters,
  studyPrograms,
  studentProgramEnrollments,
  courses,
  courseEnrollments,
  courseWeeks,
  quizzes,
  questions,
  questionOptions,
  flashcards,
  clubs,
  clubMembers,
  clubMessages,
  announcements,
} from "./schema"
import bcrypt from "bcryptjs"

type UserRole = "ADMIN" | "PROFESSOR" | "STUDENT"

function stripChoicePrefix(value: string) {
  return value.replace(/^[A-D]\)\s*/, "")
}

async function createSeedUser(data: {
  name: string
  fullName: string
  email: string
  role: UserRole
  passwordHash: string
}) {
  const [user] = await db
    .insert(users)
    .values({
      name: data.name,
      fullName: data.fullName,
      email: data.email,
      role: data.role,
    })
    .returning()

  await db.insert(userAuth).values({
    userId: user.id,
    passwordHash: data.passwordHash,
  })

  return user
}

async function main() {
  console.log("🌱 Starting database seeding...")

  console.log("🧹 Cleaning existing seed data...")
  await db.delete(users)
  await db.delete(schoolYears)
  await db.delete(studyPrograms)
  await db.delete(courses)
  await db.delete(clubs)

  const passwordHash = await bcrypt.hash("password123", 10)

  console.log("👥 Seeding users...")
  const adminUser = await createSeedUser({
    name: "Admin User",
    fullName: "Admin User",
    email: "admin@optimolms.com",
    role: "ADMIN",
    passwordHash,
  })

  const professorUser = await createSeedUser({
    name: "Prof. Sarah Connor",
    fullName: "Sarah Connor",
    email: "sarahconnor@optimolms.com",
    role: "PROFESSOR",
    passwordHash,
  })

  const advisorUser = await createSeedUser({
    name: "Prof. Arben Kodra",
    fullName: "Arben Kodra",
    email: "arbenkodra@optimolms.com",
    role: "PROFESSOR",
    passwordHash,
  })

  const johnStudent = await createSeedUser({
    name: "Student John Doe",
    fullName: "John Doe",
    email: "johnd@optimolms.com",
    role: "STUDENT",
    passwordHash,
  })

  const miraStudent = await createSeedUser({
    name: "Student Mira Kola",
    fullName: "Mira Kola",
    email: "mkola@optimolms.com",
    role: "STUDENT",
    passwordHash,
  })

  console.log("🏫 Seeding academic structure...")
  const [schoolYear] = await db
    .insert(schoolYears)
    .values({
      name: "2025-2026",
      startDate: "2025-09-01",
      endDate: "2026-06-30",
      isActive: true,
    })
    .returning()

  await db.insert(semesters).values([
    {
      schoolYearId: schoolYear.id,
      type: "FIRST",
      startDate: "2025-09-01",
      midDate: "2025-11-15",
      endDate: "2026-01-31",
    },
    {
      schoolYearId: schoolYear.id,
      type: "SECOND",
      startDate: "2026-02-01",
      midDate: "2026-04-15",
      endDate: "2026-06-30",
    },
  ])

  const [computerScienceProgram, dataScienceProgram] = await db
    .insert(studyPrograms)
    .values([
      {
        name: "Computer Science",
        code: "CS",
        description: "Bachelor of Computer Science",
        schoolYearId: schoolYear.id,
      },
      {
        name: "Data Science",
        code: "DS",
        description: "Bachelor of Data Science and Analytics",
        schoolYearId: schoolYear.id,
      },
    ])
    .returning()

  await db.insert(studentProgramEnrollments).values([
    {
      studentId: johnStudent.id,
      studyProgramId: computerScienceProgram.id,
      schoolYearId: schoolYear.id,
    },
    {
      studentId: miraStudent.id,
      studyProgramId: dataScienceProgram.id,
      schoolYearId: schoolYear.id,
    },
  ])

  console.log("📚 Seeding courses and course content...")
  const [machineLearningCourse, webEngineeringCourse, visualizationCourse] =
    await db
      .insert(courses)
      .values([
        {
          title: "Advanced Machine Learning",
          description:
            "Linear models, cost functions, gradient descent, and regularization.",
          teacherId: professorUser.id,
          schoolYearId: schoolYear.id,
          studyProgramId: computerScienceProgram.id,
          semester: "FIRST",
          isPublished: true,
        },
        {
          title: "Web Application Engineering",
          description:
            "Full-stack application patterns with authentication, data models, and UI workflows.",
          teacherId: professorUser.id,
          schoolYearId: schoolYear.id,
          studyProgramId: computerScienceProgram.id,
          semester: "SECOND",
          isPublished: true,
        },
        {
          title: "Data Visualization Studio",
          description:
            "Practical dashboards, visual encodings, and storytelling with data.",
          teacherId: advisorUser.id,
          schoolYearId: schoolYear.id,
          studyProgramId: dataScienceProgram.id,
          semester: "FIRST",
          isPublished: true,
        },
      ])
      .returning()

  await db.insert(courseEnrollments).values([
    {
      studentId: johnStudent.id,
      courseId: machineLearningCourse.id,
    },
    {
      studentId: miraStudent.id,
      courseId: machineLearningCourse.id,
    },
    {
      studentId: johnStudent.id,
      courseId: webEngineeringCourse.id,
    },
    {
      studentId: miraStudent.id,
      courseId: visualizationCourse.id,
    },
  ])

  const seededWeeks = await db
    .insert(courseWeeks)
    .values([
      {
        courseId: machineLearningCourse.id,
        weekNumber: 1,
        title: "Model Foundations",
        description:
          "Vectors, features, loss functions, and the supervised learning workflow.",
      },
      {
        courseId: machineLearningCourse.id,
        weekNumber: 2,
        title: "Optimization",
        description: "Gradient descent, learning rates, and validation curves.",
      },
      {
        courseId: webEngineeringCourse.id,
        weekNumber: 1,
        title: "Product Skeleton",
        description:
          "Routing, shared layouts, auth guards, and data access boundaries.",
      },
      {
        courseId: webEngineeringCourse.id,
        weekNumber: 2,
        title: "Server Actions",
        description:
          "Mutations, validation, cache revalidation, and error handling.",
      },
      {
        courseId: visualizationCourse.id,
        weekNumber: 1,
        title: "Visual Encoding",
        description: "Choosing marks, channels, and comparison structures.",
      },
      {
        courseId: visualizationCourse.id,
        weekNumber: 2,
        title: "Dashboard Critique",
        description:
          "Improving scan paths, density, color, and narrative emphasis.",
      },
    ])
    .returning()

  const weekByCourseAndNumber = (courseId: string, weekNumber: number) => {
    const week = seededWeeks.find(
      (item) => item.courseId === courseId && item.weekNumber === weekNumber
    )

    if (!week) {
      throw new Error(
        `Missing seeded week ${weekNumber} for course ${courseId}`
      )
    }

    return week
  }

  const mlWeekOne = weekByCourseAndNumber(machineLearningCourse.id, 1)
  const webWeekOne = weekByCourseAndNumber(webEngineeringCourse.id, 1)
  const vizWeekOne = weekByCourseAndNumber(visualizationCourse.id, 1)
  const mlWeekTwo = weekByCourseAndNumber(machineLearningCourse.id, 2)

  const [mlQuiz] = await db
    .insert(quizzes)
    .values({
      weekId: mlWeekOne.id,
      title: "Model Foundations Check",
      description: "Quick practice quiz for supervised learning basics.",
      type: "practice",
      timeLimitMinutes: 15,
    })
    .returning()

  const [mlQuestionOne, mlQuestionTwo] = await db
    .insert(questions)
    .values([
      {
        quizId: mlQuiz.id,
        type: "true_false",
        content:
          "A loss function measures how far predictions are from expected outputs.",
        points: 1,
        orderIndex: 1,
      },
      {
        quizId: mlQuiz.id,
        type: "multiple_choice",
        content: "Which technique helps reduce overfitting?",
        points: 2,
        orderIndex: 2,
      },
    ])
    .returning()

  await db.insert(questionOptions).values([
    {
      questionId: mlQuestionOne.id,
      content: "True",
      isCorrect: true,
      explanation: "Loss functions quantify prediction error.",
    },
    {
      questionId: mlQuestionOne.id,
      content: "False",
      isCorrect: false,
    },
    {
      questionId: mlQuestionTwo.id,
      content: "Regularization",
      isCorrect: true,
      explanation: "Regularization discourages overly complex models.",
    },
    {
      questionId: mlQuestionTwo.id,
      content: "Increasing noise in labels",
      isCorrect: false,
    },
    {
      questionId: mlQuestionTwo.id,
      content: "Removing validation data",
      isCorrect: false,
    },
  ])

  // Flashcards: Model Foundations (mlWeekOne), Web, Visualization, and Optimization (mlWeekTwo)
  await db.insert(flashcards).values([
    // Model Foundations flashcards
    {
      weekId: mlWeekOne.id,
      frontContent: "What is a vector in machine learning?",
      backContent:
        "A numerical array representing features of a data point in a multi-dimensional space.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "Define features in ML.",
      backContent:
        "Individual measurable properties or characteristics of the data used as input variables for the model.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is a feature vector?",
      backContent:
        "A vector that contains all the feature values for a single data point, representing it in the feature space.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is supervised learning?",
      backContent:
        "A machine learning paradigm where the model is trained on labeled data (input-output pairs).",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is the primary goal of supervised learning?",
      backContent:
        "To learn a mapping function from input features (X) to output labels (y).",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "Types of supervised learning tasks",
      backContent:
        "Classification (discrete labels) and Regression (continuous values).",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is a loss function?",
      backContent:
        "A function that quantifies the difference between the predicted output and the true label, guiding model optimization.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What does MSE stand for and what is it used for?",
      backContent:
        "Mean Squared Error; a common loss function for regression tasks that averages the squared differences between predictions and true values.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is cross-entropy loss?",
      backContent:
        "A loss function commonly used for classification tasks, measuring the difference between two probability distributions.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "4 main steps of supervised learning workflow",
      backContent:
        "1) Data Collection, 2) Data Preprocessing, 3) Model Training, 4) Model Evaluation.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is training data?",
      backContent:
        "The portion of the dataset used to train the model by adjusting its parameters.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is test data?",
      backContent:
        "The portion of the dataset reserved for final evaluation of the model's performance on unseen data.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is validation data?",
      backContent:
        "The portion of the dataset used to tune hyperparameters and prevent overfitting during development.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is overfitting?",
      backContent:
        "When a model learns the training data too well, including noise and outliers, resulting in poor generalization to new data.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is underfitting?",
      backContent:
        "When a model is too simple to capture the underlying patterns in the data, resulting in poor performance.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is the bias-variance tradeoff?",
      backContent:
        "The balance between a model's ability to fit the training data (low bias) and its ability to generalize to new data (low variance).",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is a hypothesis in ML?",
      backContent:
        "A function that maps input features to output predictions, parameterized by the model.",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is a model parameter?",
      backContent:
        "Internal variables of the model that are learned from the training data (e.g., weights).",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is a hyperparameter?",
      backContent:
        "Configuration variables external to the model that must be set before training (e.g., learning rate).",
    },
    {
      weekId: mlWeekOne.id,
      frontContent: "What is feature scaling?",
      backContent:
        "The process of normalizing or standardizing feature values to a similar range to improve model performance.",
    },

    // Existing web and viz flashcards
    {
      weekId: webWeekOne.id,
      frontContent: "Server action",
      backContent:
        "A server-side function callable from React components or forms in a Next.js application.",
    },
    {
      weekId: vizWeekOne.id,
      frontContent: "Visual channel",
      backContent:
        "A visual property such as position, length, color, or size used to encode data.",
    },

    // Optimization flashcards (mlWeekTwo)
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is gradient descent?",
      backContent:
        "An iterative optimization algorithm used to minimize the loss function by moving in the direction of the steepest descent (negative gradient).",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is the learning rate in gradient descent?",
      backContent:
        "A hyperparameter that determines the step size at each iteration while moving toward a minimum of the loss function.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is a gradient?",
      backContent:
        "A vector of partial derivatives of the loss function with respect to each parameter, indicating the direction of steepest ascent.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is stochastic gradient descent (SGD)?",
      backContent:
        "A variant of gradient descent that uses a single random training example per iteration to compute the gradient, making it faster but noisier.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is batch gradient descent?",
      backContent:
        "A variant that uses the entire training dataset to compute the gradient for each iteration, ensuring stable convergence but computationally expensive.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is mini-batch gradient descent?",
      backContent:
        "A variant that uses a small random batch of training examples per iteration, balancing the trade-offs of SGD and batch gradient descent.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is a local minimum?",
      backContent:
        "A point in the loss landscape where the loss is lower than all nearby points, but not necessarily the lowest point in the entire space.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is a global minimum?",
      backContent:
        "The point in the loss landscape with the lowest possible loss value across the entire parameter space.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is momentum in gradient descent?",
      backContent:
        "A technique that accelerates gradient descent in the relevant direction by adding a fraction of the previous update to the current update.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is a validation curve?",
      backContent:
        "A plot showing the model's performance as a function of a hyperparameter (e.g., learning rate, model complexity).",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is learning rate scheduling?",
      backContent:
        "The practice of adjusting the learning rate during training, often by reducing it over time to fine-tune the model's parameters.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is a saddle point?",
      backContent:
        "A point in the loss landscape where the gradient is zero but the point is neither a minimum nor a maximum.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is convex optimization?",
      backContent:
        "Optimization on convex loss functions, where any local minimum is the global minimum.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is the role of the gradient in optimization?",
      backContent:
        "The gradient points in the direction of the steepest ascent of the loss function; gradient descent moves opposite to it to minimize the loss.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is early stopping?",
      backContent:
        "A regularization technique that stops the training process when the validation error stops improving.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is the Adam optimizer?",
      backContent:
        "An adaptive learning rate optimization algorithm that combines the benefits of momentum and RMSprop.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What is RMSprop?",
      backContent:
        "An adaptive learning rate method that divides the learning rate by an exponentially decaying average of squared gradients.",
    },
    {
      weekId: mlWeekTwo.id,
      frontContent: "What happens if the learning rate is too large?",
      backContent:
        "The algorithm may overshoot the minimum, causing divergence or oscillation, and the loss may increase instead of decreasing.",
    },
  ])

  // Add additional Model Foundations quiz questions (short answer)
  const additionalMlQuestions: (typeof questions.$inferInsert)[] = [
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "Explain the difference between features and labels in supervised learning.",
      points: 2,
      orderIndex: 3,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content: "How does a loss function contribute to model training?",
      points: 2,
      orderIndex: 4,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "What is the key difference between classification and regression tasks?",
      points: 2,
      orderIndex: 5,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "Describe the typical workflow of a supervised learning project.",
      points: 3,
      orderIndex: 6,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content: "Why is it important to split data into training and test sets?",
      points: 2,
      orderIndex: 7,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "What is the purpose of the validation set in model development?",
      points: 2,
      orderIndex: 8,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content: "How can you detect overfitting in a model?",
      points: 2,
      orderIndex: 9,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "What is the difference between model parameters and hyperparameters?",
      points: 2,
      orderIndex: 10,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "Why is feature scaling important in many machine learning algorithms?",
      points: 2,
      orderIndex: 11,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "What role does the learning algorithm play in supervised learning?",
      points: 2,
      orderIndex: 12,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "How do you choose an appropriate loss function for a given task?",
      points: 2,
      orderIndex: 13,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content: "What is the difference between MSE and MAE?",
      points: 2,
      orderIndex: 14,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content: "How does model complexity affect bias and variance?",
      points: 2,
      orderIndex: 15,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "What are some common preprocessing steps in supervised learning?",
      points: 2,
      orderIndex: 16,
    },
    {
      quizId: mlQuiz.id,
      type: "multiple_choice",
      content:
        "How do you evaluate the performance of a supervised learning model?",
      points: 2,
      orderIndex: 17,
    },
  ]

  await db.insert(questions).values(additionalMlQuestions).returning()

  // Model Foundations: true/false questions
  const mfTrueFalse = [
    {
      content:
        "Vectors are only used in deep learning and not in traditional machine learning models.",
      answer: false,
      explanation:
        "Vectors are fundamental to all machine learning models, representing features in the input space for both traditional and deep learning models.",
    },
    {
      content:
        "The loss function measures how well the model is performing on the training data.",
      answer: true,
      explanation:
        "The loss function quantifies the error between predictions and true labels, directly measuring model performance during training.",
    },
    {
      content: "Supervised learning requires labeled data for training.",
      answer: true,
      explanation:
        "Supervised learning relies on labeled data (input-output pairs) to train the model to make predictions.",
    },
    {
      content:
        "Overfitting occurs when the model is too simple to capture the underlying patterns in the data.",
      answer: false,
      explanation:
        "Overfitting occurs when the model is too complex, capturing noise and outliers in the training data, leading to poor generalization.",
    },
    {
      content:
        "Feature scaling is always necessary for every machine learning algorithm.",
      answer: false,
      explanation:
        "Some algorithms (e.g., decision trees, random forests) are scale-invariant and do not require feature scaling.",
    },
  ]

  let tfOrder = 18
  for (const tf of mfTrueFalse) {
    const [q] = await db
      .insert(questions)
      .values({
        quizId: mlQuiz.id,
        type: "true_false",
        content: tf.content,
        points: 1,
        orderIndex: tfOrder,
      })
      .returning()

    await db.insert(questionOptions).values([
      {
        questionId: q.id,
        content: "True",
        isCorrect: tf.answer === true,
        explanation: tf.answer === true ? tf.explanation : undefined,
      },
      {
        questionId: q.id,
        content: "False",
        isCorrect: tf.answer === false,
        explanation: tf.answer === false ? tf.explanation : undefined,
      },
    ])

    tfOrder += 1
  }

  // Model Foundations: multiple-choice alternatives
  const mfAlts = [
    {
      question:
        "Which of the following is NOT a type of supervised learning task?",
      options: [
        "A) Classification",
        "B) Regression",
        "C) Clustering",
        "D) Ranking",
      ],
      correct: "C) Clustering",
      explanation:
        "Clustering is an unsupervised learning task, it groups data without labels.",
    },
    {
      question:
        "What is the most commonly used loss function for regression tasks?",
      options: [
        "A) Cross-entropy loss",
        "B) Mean Squared Error (MSE)",
        "C) Hinge loss",
        "D) KL divergence",
      ],
      correct: "B) Mean Squared Error (MSE)",
      explanation:
        "MSE is widely used for regression due to its differentiability and heavy penalty on large errors.",
    },
    {
      question:
        "Which dataset split is used for the final evaluation of a model's performance?",
      options: [
        "A) Training set",
        "B) Validation set",
        "C) Test set",
        "D) All of the above",
      ],
      correct: "C) Test set",
      explanation:
        "The test set is reserved for final evaluation to assess the model's generalization to unseen data.",
    },
    {
      question: "What does MSE stand for?",
      options: [
        "A) Model Standard Error",
        "B) Mean Squared Error",
        "C) Mean Standard Error",
        "D) Model Squared Error",
      ],
      correct: "B) Mean Squared Error",
      explanation:
        "MSE is the average of the squared differences between predicted and true values.",
    },
    {
      question: "Which of the following is a sign of overfitting?",
      options: [
        "A) High training error, high test error",
        "B) Low training error, low test error",
        "C) Low training error, high test error",
        "D) High training error, low test error",
      ],
      correct: "C) Low training error, high test error",
      explanation:
        "Overfitting is characterized by low training error and high test/validation error.",
    },
    {
      question: "What is the primary purpose of feature engineering?",
      options: [
        "A) To make the model more complex",
        "B) To create new features or transform existing ones to improve model performance",
        "C) To reduce the number of features in the dataset",
        "D) To visualize the data",
      ],
      correct:
        "B) To create new features or transform existing ones to improve model performance",
      explanation:
        "Feature engineering enhances the model's ability to learn patterns by creating informative features.",
    },
    {
      question:
        "Which loss function is typically used for binary classification tasks?",
      options: [
        "A) Mean Squared Error (MSE)",
        "B) Cross-entropy loss",
        "C) Mean Absolute Error (MAE)",
        "D) R-squared",
      ],
      correct: "B) Cross-entropy loss",
      explanation:
        "Cross-entropy is standard for classification as it measures the difference between predicted and true probability distributions.",
    },
    {
      question: "What does the bias-variance tradeoff balance?",
      options: [
        "A) Model accuracy and training speed",
        "B) Underfitting and overfitting",
        "C) Training time and memory usage",
        "D) Feature importance and model weights",
      ],
      correct: "B) Underfitting and overfitting",
      explanation:
        "The tradeoff balances the model's ability to fit training data and generalize to new data.",
    },
    {
      question:
        "Which of the following is NOT a preprocessing step in machine learning?",
      options: [
        "A) Normalization",
        "B) Feature selection",
        "C) Model evaluation",
        "D) Handling missing values",
      ],
      correct: "C) Model evaluation",
      explanation:
        "Model evaluation is separate and occurs after preprocessing and training.",
    },
    {
      question: "What is the typical output of a regression model?",
      options: [
        "A) A class label",
        "B) A probability",
        "C) A continuous numerical value",
        "D) A binary value",
      ],
      correct: "C) A continuous numerical value",
      explanation: "Regression models predict continuous values.",
    },
  ]

  let altOrder = 18 + mfTrueFalse.length
  for (const alt of mfAlts) {
    const [q] = await db
      .insert(questions)
      .values({
        quizId: mlQuiz.id,
        type: "multiple_choice",
        content: alt.question,
        points: 2,
        orderIndex: altOrder,
      })
      .returning()

    const correctOption = stripChoicePrefix(alt.correct)

    await db.insert(questionOptions).values(
      alt.options.map((opt) => ({
        questionId: q.id,
        content: stripChoicePrefix(opt),
        isCorrect: stripChoicePrefix(opt) === correctOption,
        explanation:
          stripChoicePrefix(opt) === correctOption
            ? alt.explanation
            : undefined,
      }))
    )

    altOrder += 1
  }

  // Create Optimization quiz for mlWeekTwo
  const [optQuiz] = await db
    .insert(quizzes)
    .values({
      weekId: mlWeekTwo.id,
      title: "Optimization Check",
      description:
        "Questions on gradient descent, learning rates, and optimizers.",
      type: "practice",
      timeLimitMinutes: 20,
    })
    .returning()

  // Optimization quiz questions (short answer)
  const optQuestions: (typeof questions.$inferInsert)[] = [
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content:
        "Explain how gradient descent works to minimize the loss function.",
      points: 3,
      orderIndex: 1,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content:
        "What is the difference between SGD, batch, and mini-batch gradient descent?",
      points: 2,
      orderIndex: 2,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "How does the learning rate affect convergence?",
      points: 2,
      orderIndex: 3,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "What is the purpose of momentum in gradient descent?",
      points: 2,
      orderIndex: 4,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "How do you choose an appropriate learning rate?",
      points: 2,
      orderIndex: 5,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "What is a validation curve?",
      points: 2,
      orderIndex: 6,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "Explain local vs global minima.",
      points: 2,
      orderIndex: 7,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "What are saddle points and why are they problematic?",
      points: 2,
      orderIndex: 8,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "How does learning rate scheduling help in training?",
      points: 2,
      orderIndex: 9,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content: "What is early stopping, and when should it be used?",
      points: 2,
      orderIndex: 10,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content:
        "How do adaptive optimizers like Adam differ from standard gradient descent?",
      points: 2,
      orderIndex: 11,
    },
    {
      quizId: optQuiz.id,
      type: "multiple_choice",
      content:
        "What is the relationship between batch size and convergence speed?",
      points: 2,
      orderIndex: 12,
    },
  ]

  await db.insert(questions).values(optQuestions).returning()

  // Optimization true/false
  const optTF = [
    {
      content:
        "Gradient descent always finds the global minimum of the loss function.",
      answer: false,
      explanation:
        "Gradient descent finds a local minimum, which may not be the global minimum in non-convex landscapes.",
    },
    {
      content:
        "A smaller learning rate always leads to faster convergence in gradient descent.",
      answer: false,
      explanation:
        "A smaller learning rate leads to slower convergence; too-small rates can stall training.",
    },
    {
      content:
        "Momentum helps accelerate gradient descent and dampens oscillations.",
      answer: true,
      explanation:
        "Momentum adds inertia to updates, speeding convergence and reducing oscillation.",
    },
    {
      content:
        "SGD is always better than batch gradient descent for all tasks.",
      answer: false,
      explanation:
        "SGD is faster per iteration but noisier; the best choice depends on problem/resources.",
    },
    {
      content:
        "The validation curve can help identify the best learning rate for a model.",
      answer: true,
      explanation:
        "Validation curves plot performance vs hyperparameter values, helping pick the best value.",
    },
  ]

  let optTfOrder = 13
  for (const tf of optTF) {
    const [q] = await db
      .insert(questions)
      .values({
        quizId: optQuiz.id,
        type: "true_false",
        content: tf.content,
        points: 1,
        orderIndex: optTfOrder,
      })
      .returning()

    await db.insert(questionOptions).values([
      {
        questionId: q.id,
        content: "True",
        isCorrect: tf.answer === true,
        explanation: tf.answer === true ? tf.explanation : undefined,
      },
      {
        questionId: q.id,
        content: "False",
        isCorrect: tf.answer === false,
        explanation: tf.answer === false ? tf.explanation : undefined,
      },
    ])

    optTfOrder += 1
  }

  // Optimization alternatives (multiple-choice)
  const optAlts = [
    {
      question:
        "Which optimization algorithm uses the gradient of the loss function to iteratively update model parameters?",
      options: [
        "A) Genetic Algorithm",
        "B) Gradient Descent",
        "C) Simulated Annealing",
        "D) Particle Swarm Optimization",
      ],
      correct: "B) Gradient Descent",
      explanation:
        "Gradient descent is a first-order optimization algorithm that relies on the gradient.",
    },
    {
      question:
        "What happens if the learning rate in gradient descent is set too high?",
      options: [
        "A) The model converges faster to the global minimum",
        "B) The model may diverge or oscillate, failing to converge",
        "C) The model converges more slowly but stably",
        "D) The model accuracy improves monotonically",
      ],
      correct: "B) The model may diverge or oscillate, failing to converge",
      explanation:
        "A too-high learning rate can cause the updates to overshoot the minimum.",
    },
    {
      question:
        "Which variant of gradient descent uses the entire training dataset to compute the gradient for each update?",
      options: [
        "A) Stochastic Gradient Descent (SGD)",
        "B) Mini-batch Gradient Descent",
        "C) Batch Gradient Descent",
        "D) Online Gradient Descent",
      ],
      correct: "C) Batch Gradient Descent",
      explanation:
        "Batch gradient descent computes the gradient using all training examples.",
    },
    {
      question: "What does a validation curve typically plot?",
      options: [
        "A) Training error vs. Test error over epochs",
        "B) Model performance vs. a hyperparameter",
        "C) Loss vs. Number of training iterations",
        "D) Accuracy vs. Training time",
      ],
      correct: "B) Model performance vs. a hyperparameter",
      explanation:
        "Validation curves show how performance varies with hyperparameter values.",
    },
    {
      question:
        "Which of the following is an adaptive optimization method that adjusts learning rates per parameter?",
      options: ["A) SGD", "B) Momentum", "C) Adam", "D) All of the above"],
      correct: "C) Adam",
      explanation:
        "Adam adjusts learning rates per parameter and includes momentum-like updates.",
    },
    {
      question: "Which technique helps gradient descent escape local minima?",
      options: [
        "A) Using a smaller learning rate",
        "B) Using momentum",
        "C) Using a larger batch size",
        "D) All of the above",
      ],
      correct: "B) Using momentum",
      explanation:
        "Momentum adds inertia to updates, allowing escape from shallow minima.",
    },
    {
      question:
        "Which property of the loss landscape makes optimization more challenging?",
      options: [
        "A) Convexity",
        "B) Non-convexity",
        "C) Smoothness",
        "D) Linearity",
      ],
      correct: "B) Non-convexity",
      explanation:
        "Non-convex landscapes have multiple local minima and saddle points.",
    },
    {
      question:
        "What is the primary purpose of early stopping in training neural networks?",
      options: [
        "A) To reduce training time",
        "B) To prevent overfitting",
        "C) To increase model complexity",
        "D) To improve training accuracy",
      ],
      correct: "B) To prevent overfitting",
      explanation:
        "Early stopping halts training when validation error stops improving.",
    },
    {
      question: "Which of the following is NOT a variant of gradient descent?",
      options: ["A) RMSprop", "B) Adagrad", "C) K-means", "D) Adam"],
      correct: "C) K-means",
      explanation:
        "K-means is a clustering algorithm, not a gradient-descent variant.",
    },
    {
      question:
        "In a validation curve plotting performance against learning rate, what is typically observed as the learning rate increases from very small to very large?",
      options: [
        "A) Validation error decreases monotonically",
        "B) Validation error first decreases, reaches a minimum, then increases",
        "C) Validation error increases monotonically",
        "D) Validation error remains constant",
      ],
      correct:
        "B) Validation error first decreases, reaches a minimum, then increases",
      explanation:
        "At very small rates convergence is slow; moderate rates minimize error; very high rates cause divergence.",
    },
  ]

  let optAltOrder = 13 + optTF.length
  for (const alt of optAlts) {
    const [q] = await db
      .insert(questions)
      .values({
        quizId: optQuiz.id,
        type: "multiple_choice",
        content: alt.question,
        points: 2,
        orderIndex: optAltOrder,
      })
      .returning()

    const correctOption = stripChoicePrefix(alt.correct)

    await db.insert(questionOptions).values(
      alt.options.map((opt) => ({
        questionId: q.id,
        content: stripChoicePrefix(opt),
        isCorrect: stripChoicePrefix(opt) === correctOption,
        explanation:
          stripChoicePrefix(opt) === correctOption
            ? alt.explanation
            : undefined,
      }))
    )

    optAltOrder += 1
  }

  console.log("🎯 Seeding full-year clubs, members, and chat...")
  const [roboticsClub, webBuildersClub, cultureClub] = await db
    .insert(clubs)
    .values([
      {
        name: "Robotics & AI Club",
        description:
          "Students build small robotics prototypes and experiment with machine learning ideas.",
        schoolYearId: schoolYear.id,
      },
      {
        name: "Web Builders Club",
        description:
          "A practical club for shipping portfolio projects, hackathon apps, and campus tools.",
        schoolYearId: schoolYear.id,
      },
      {
        name: "Campus Culture Club",
        description:
          "A student-led space for events, community projects, and creative campus activities.",
        schoolYearId: schoolYear.id,
      },
    ])
    .returning()

  await db.insert(clubMembers).values([
    {
      clubId: roboticsClub.id,
      userId: johnStudent.id,
      role: "LEADER",
    },
    {
      clubId: roboticsClub.id,
      userId: miraStudent.id,
      role: "MEMBER",
    },
    {
      clubId: roboticsClub.id,
      userId: advisorUser.id,
      role: "ADVISOR",
    },
    {
      clubId: webBuildersClub.id,
      userId: miraStudent.id,
      role: "LEADER",
    },
    {
      clubId: webBuildersClub.id,
      userId: johnStudent.id,
      role: "MEMBER",
    },
    {
      clubId: webBuildersClub.id,
      userId: professorUser.id,
      role: "ADVISOR",
    },
    {
      clubId: cultureClub.id,
      userId: johnStudent.id,
      role: "MEMBER",
    },
    {
      clubId: cultureClub.id,
      userId: miraStudent.id,
      role: "MEMBER",
    },
  ])

  await db.insert(clubMessages).values([
    {
      clubId: roboticsClub.id,
      authorId: advisorUser.id,
      content:
        "Welcome to the full-year Robotics & AI Club. Introduce yourself and share what you want to build this year.",
      createdAt: new Date("2025-09-05T09:00:00"),
      updatedAt: new Date("2025-09-05T09:00:00"),
    },
    {
      clubId: roboticsClub.id,
      authorId: johnStudent.id,
      content: "I can bring the sensor kit for our first prototype discussion.",
      createdAt: new Date("2025-09-05T09:18:00"),
      updatedAt: new Date("2025-09-05T09:18:00"),
    },
    {
      clubId: webBuildersClub.id,
      authorId: miraStudent.id,
      content:
        "I added the deployment checklist. Let us use it for every project demo this year.",
      createdAt: new Date("2025-09-06T14:30:00"),
      updatedAt: new Date("2025-09-06T14:30:00"),
    },
    {
      clubId: webBuildersClub.id,
      authorId: professorUser.id,
      content:
        "Nice. Keep project links and setup notes in the chat so new members can catch up quickly.",
      createdAt: new Date("2025-09-06T15:10:00"),
      updatedAt: new Date("2025-09-06T15:10:00"),
    },
    {
      clubId: cultureClub.id,
      authorId: johnStudent.id,
      content:
        "The event template is up. Add ideas there before we vote on the first activity.",
      createdAt: new Date("2025-09-07T11:45:00"),
      updatedAt: new Date("2025-09-07T11:45:00"),
    },
  ])

  await db.insert(announcements).values([
    {
      title: "Welcome to the 2025-2026 academic year",
      content:
        "Courses, student clubs, and professor-led activities are now available in the dashboard.",
      scope: "global",
      authorId: adminUser.id,
      isPinned: true,
      isPublished: true,
      publishedAt: new Date("2025-09-01T09:00:00"),
    },
    {
      title: "Robotics & AI Club is open",
      content:
        "Nice. Keep project links and setup notes in the chat so new members can catch up quickly.",
      scope: "club",
      referenceId: roboticsClub.id,
      authorId: advisorUser.id,
      isPinned: false,
      isPublished: true,
      publishedAt: new Date("2026-05-20T10:00:00"),
    },
  ])

  console.log("✨ Seeding completed successfully!")
  console.log("--------------------------------------------------")
  console.log("Test Credentials (Password for all: password123):")
  console.log(" - Admin:          admin@optimolms.com")
  console.log(" - Professor:      professor@optimolms.com")
  console.log(" - Club Advisor:   advisor@optimolms.com")
  console.log(" - Student:        student@optimolms.com")
  console.log(" - Second Student: student2@optimolms.com")
  console.log("--------------------------------------------------")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
