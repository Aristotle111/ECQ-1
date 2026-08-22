"use client";
import { useState, useEffect, useRef } from "react";
import BorderGlow from "@/components/BorderGlow";
import FlowingMenu from '@/components/FlowingMenu'
import CardNav from '@/components/CardNav';
import LanguageToggle from '@/components/LanguageToggle';
import GridPattern from '@/components/ui/grid-pattern';
import GooeyNav from '@/components/GooeyNav';
import { cn } from "@/lib/utils";
import { Space_Grotesk, Inter } from 'next/font/google';
import DragDropCanvas, { DragDropTask } from '@/components/DragDropCanvas';
import DynamicProblemCanvas, { DynamicProblemTask } from '@/components/DynamicProblemCanvas';
import BilingualHighlighter, { BilingualTask } from '@/components/BilingualHighlighter';
import useSound from 'use-sound';
import { useWindowSize } from "@/lib/useWindowSize";

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });
const inter = Inter({ subsets: ['latin'] });

type Language = "EN" | "FR";
type Difficulty = "beginner" | "intermediate" | "advanced";

const navItems = {
  EN: [
    { label: "Control the Complexity", path: "/about", bgColor: "#0e0e0e", textColor: "#ffc4c4", description: "Slide between basic, intermediate, and advanced versions of the same problem to build confidence at your own pace." },
    { label: "Drag, Drop, Learn", path: "/about", bgColor: "#0e0e0e", textColor: "#b7eeff", description: "Reconstruct problem solutions through interactive drag-and-drop tasks that test both logic and language." },
    { label: "Highlight What Matters", path: "/about", bgColor: "#0e0e0e", textColor: "#d0bbff", description: "Aligned phrases glow together when hovered, helping you connect meaning across languages and levels." },
    { label: "Understand, Don't Memorize", path: "/about", bgColor: "#0e0e0e", textColor: "#bbffbf", description: "Visual tools, animations, phrasing breakdowns help you see how the math really works." }
  ],
  FR: [
    { label: "Contrôlez la Complexité", path: "/about", bgColor: "#0e0e0e", textColor: "#ffc4c4", description: "Basculez entre les versions de base, intermédiaire et avancée du même problème pour gagner en confiance à votre rythme." },
    { label: "Glissez, Déposez, Apprenez", path: "/about", bgColor: "#0e0e0e", textColor: "#b7eeff", description: "Reconstruisez les solutions aux problèmes via des tâches interactives qui testent la logique et la langue." },
    { label: "Surlignez l'Essentiel", path: "/about", bgColor: "#0e0e0e", textColor: "#d0bbff", description: "Les phrases alignées s'illuminent au survol, vous aidant à connecter le sens à travers les langues." },
    { label: "Comprendre Sans Mémoriser", path: "/about", bgColor: "#0e0e0e", textColor: "#bbffbf", description: "Des outils visuels, des animations et des analyses de phrases vous aident à voir comment fonctionnent les mathématiques." }
  ]
};

const difficultyLabels = {
  EN: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" },
  FR: { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé" }
};

const difficultyKeys: Difficulty[] = ["beginner", "intermediate", "advanced"];

const App = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<Language>("EN");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");

  const isMobile = useWindowSize();

  const [playMenuClick] = useSound('/sounds/menu_Click2.mp3', { volume: 0.75 });
  const [playLanguageClick] = useSound('/sounds/language_click.mp3', { volume: 0.55 });
  const [playDifficultyClick] = useSound('/sounds/difficulty_Click.mp3', { volume: 0.65 });

  const [isBilingualExpanded, setIsBilingualExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showAudioOptions, setShowAudioOptions] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [showDiagram, setShowDiagram] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);
  const currentChunkIndexRef = useRef<number>(0);
  const chunksRef = useRef<{ text: string; lang: Language }[]>([]);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);

  const playbackRateRef = useRef(1);
  const [currentDynamicText, setCurrentDynamicText] = useState<string | null>(null);

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    pausedAtRef.current = 0;
    startedAtRef.current = 0;
    setIsPlaying(false);
    setIsPaused(false);
    setShowAudioOptions(false);
  };

  const playCurrentBuffer = (offset: number) => {
    const ctx = audioContextRef.current;
    const buffer = currentBufferRef.current;
    if (!ctx || !buffer) return;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRateRef.current;
    source.connect(ctx.destination);

    source.onended = () => {
      currentChunkIndexRef.current += 1;
      loadAndPlayChunk(currentChunkIndexRef.current);
    };

    source.start(0, offset);
    sourceNodeRef.current = source;
    startedAtRef.current = ctx.currentTime;
  };

  const loadAndPlayChunk = async (index: number) => {
    if (index >= chunksRef.current.length) {
      stopPlayback();
      return;
    }

    const chunk = chunksRef.current[index];
    const langCode = chunk.lang === "FR" ? "fr-FR" : "en-US";
    const textEncoded = encodeURIComponent(chunk.text);

    try {
      const response = await fetch(`/api/tts?text=${textEncoded}&lang=${langCode}`);
      if (!response.ok) throw new Error("TTS failed");

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

      currentBufferRef.current = audioBuffer;
      pausedAtRef.current = 0;

      playCurrentBuffer(0);
    } catch (error) {
      console.error("Audio fetch/playback error:", error);
      stopPlayback();
    }
  };

  const handlePlayPause = async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      if (isPaused) {
        playCurrentBuffer(pausedAtRef.current);
        setIsPaused(false);
      } else {
        if (sourceNodeRef.current && audioContextRef.current) {
          const elapsed = (audioContextRef.current.currentTime - startedAtRef.current) * playbackRateRef.current;
          pausedAtRef.current += elapsed;

          sourceNodeRef.current.onended = null;
          sourceNodeRef.current.stop();
          sourceNodeRef.current.disconnect();
          sourceNodeRef.current = null;
        }
        setIsPaused(true);
      }
      return;
    }

    const chunks = getReadableChunks();
    if (chunks.length === 0 || !chunks[0].text) return;

    chunksRef.current = chunks;
    currentChunkIndexRef.current = 0;
    
    setIsPlaying(true);
    setIsPaused(false);

    loadAndPlayChunk(0);
  };

  const handleRewind = () => {
    if (!sourceNodeRef.current || !audioContextRef.current) return;

    const elapsed = (audioContextRef.current.currentTime - startedAtRef.current) * playbackRateRef.current + pausedAtRef.current;
    const newOffset = Math.max(0, elapsed - 5);

    sourceNodeRef.current.onended = null;
    sourceNodeRef.current.stop();

    pausedAtRef.current = newOffset;
    if (!isPaused) {
      playCurrentBuffer(newOffset);
    }
  };

  const toggleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.25 : playbackRate === 1.25 ? 1.5 : playbackRate === 1.5 ? 0.75 : 1;
    setPlaybackRate(nextRate);
    playbackRateRef.current = nextRate;

    if (sourceNodeRef.current && audioContextRef.current) {
      const elapsed = (audioContextRef.current.currentTime - startedAtRef.current) * sourceNodeRef.current.playbackRate.value;
      pausedAtRef.current += elapsed;
      startedAtRef.current = audioContextRef.current.currentTime;

      sourceNodeRef.current.playbackRate.value = nextRate;
    }
  };

  useEffect(() => {
    stopPlayback();
    setCurrentDynamicText(null);
    setShowDiagram(false);
  }, [activeIndex, currentLanguage, difficulty]);

  const getReadableChunks = (): { text: string, lang: Language }[] => {
    if (!currentProblem) return [];
    
    switch (activeIndex) {
      case 0: 
        return [{ text: currentProblem.scenarioData[difficulty].text[currentLanguage], lang: currentLanguage }];
      case 1: 
        return [{ text: dragDropTask?.prompt || "", lang: currentLanguage }];
      case 2: {
        const chunks = [{ 
          text: bilingualTask?.sentences[currentLanguage].join(". ") || "", 
          lang: currentLanguage 
        }];
        
        if (isBilingualExpanded) {
          const oppositeLanguage = currentLanguage === "EN" ? "FR" : "EN";
          chunks.push({ 
            text: bilingualTask?.sentences[oppositeLanguage].join(". ") || "", 
            lang: oppositeLanguage 
          });
        }
        return chunks;
      }
      case 3: 
        if (currentDynamicText) {
          return [{ text: currentDynamicText, lang: currentLanguage }];
        }
        return dynamicTask 
          ? [{ text: `${dynamicTask.textStart} ${dynamicTask.defaultNumber} ${dynamicTask.textEnd}`, lang: currentLanguage }] 
          : [];
      default:
        return [];
    }
  };

  interface ScenarioTask {
    title?: Record<Language, string>;
    text: Record<Language, string>;
  }

  interface ContentItem {
    title?: Record<Language, string>;
    diagramData?: Record<Difficulty, { src: string; alt: Record<Language, string>; }>;
    scenarioData: Record<Difficulty, ScenarioTask>;
    dragDropData?: Record<Difficulty, Record<Language, DragDropTask>>;
    dynamicProblemData?: Record<Difficulty, Record<Language, DynamicProblemTask>>;
    bilingualReadingData?: Record<Difficulty, BilingualTask>;
  }

  const [problems, setProblems] = useState<ContentItem[]>([
    {
      title: { 
        EN: "Binomial Probability Problem", 
        FR: "Problème de Probabilité Binomiale" 
      },
      diagramData: {
        beginner: {
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 180' width='100%' height='100%'><defs><marker id='arrow-left' viewBox='0 0 10 10' refX='0' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 10 0 L 0 5 L 10 10 z' fill='%23ffffff'/></marker><marker id='arrow-right' viewBox='0 0 10 10' refX='10' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 0 0 L 10 5 L 0 10 z' fill='%23ffffff'/></marker></defs><g transform='translate(90, 80)'><circle cx='0' cy='0' r='26' fill='%2318181b' stroke='%23ffffff' stroke-width='2.5'/><line x1='-10' y1='0' x2='10' y2='0' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><line x1='0' y1='-10' x2='0' y2='10' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><text x='0' y='46' fill='%23a1a1aa' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>+q₁</text></g><g transform='translate(410, 80)'><circle cx='0' cy='0' r='26' fill='%2318181b' stroke='%23ffffff' stroke-width='2.5'/><line x1='-10' y1='0' x2='10' y2='0' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><text x='0' y='46' fill='%23a1a1aa' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>-q₂</text></g><line x1='130' y1='80' x2='370' y2='80' stroke='%23ffffff' stroke-width='2' stroke-dasharray='4 4' marker-start='url(%23arrow-left)' marker-end='url(%23arrow-right)'/><rect x='235' y='62' width='30' height='36' fill='%2318181b' rx='6'/><text x='250' y='86' fill='%23ffffff' font-family='sans-serif' font-size='18' font-style='italic' font-weight='bold' text-anchor='middle'>r</text></svg>",
          alt: {
            EN: "Binomial probability distribution graph (Beginner)",
            FR: "Graphique de distribution de probabilité binomiale (Débutant)"
          }
        },
        intermediate: {
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 180' width='100%' height='100%'><defs><marker id='arrow-left' viewBox='0 0 10 10' refX='0' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 10 0 L 0 5 L 10 10 z' fill='%23ffffff'/></marker><marker id='arrow-right' viewBox='0 0 10 10' refX='10' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 0 0 L 10 5 L 0 10 z' fill='%23ffffff'/></marker></defs><g transform='translate(90, 80)'><circle cx='0' cy='0' r='26' fill='%2318181b' stroke='%23ffffff' stroke-width='2.5'/><line x1='-10' y1='0' x2='10' y2='0' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><line x1='0' y1='-10' x2='0' y2='10' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><text x='0' y='46' fill='%23a1a1aa' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>+q₁</text></g><g transform='translate(410, 80)'><circle cx='0' cy='0' r='26' fill='%2318181b' stroke='%23ffffff' stroke-width='2.5'/><line x1='-10' y1='0' x2='10' y2='0' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><text x='0' y='46' fill='%23a1a1aa' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>-q₂</text></g><line x1='130' y1='80' x2='370' y2='80' stroke='%23ffffff' stroke-width='2' stroke-dasharray='4 4' marker-start='url(%23arrow-left)' marker-end='url(%23arrow-right)'/><rect x='235' y='62' width='30' height='36' fill='%2318181b' rx='6'/><text x='250' y='86' fill='%23ffffff' font-family='sans-serif' font-size='18' font-style='italic' font-weight='bold' text-anchor='middle'>r</text></svg>",
          alt: {
            EN: "Binomial probability distribution graph (Intermediate)",
            FR: "Graphique de distribution de probabilité binomiale (Intermédiaire)"
          }
        },
        advanced: {
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 180' width='100%' height='100%'><defs><marker id='arrow-left' viewBox='0 0 10 10' refX='0' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 10 0 L 0 5 L 10 10 z' fill='%23ffffff'/></marker><marker id='arrow-right' viewBox='0 0 10 10' refX='10' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 0 0 L 10 5 L 0 10 z' fill='%23ffffff'/></marker></defs><g transform='translate(90, 80)'><circle cx='0' cy='0' r='26' fill='%2318181b' stroke='%23ffffff' stroke-width='2.5'/><line x1='-10' y1='0' x2='10' y2='0' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><line x1='0' y1='-10' x2='0' y2='10' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><text x='0' y='46' fill='%23a1a1aa' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>+q₁</text></g><g transform='translate(410, 80)'><circle cx='0' cy='0' r='26' fill='%2318181b' stroke='%23ffffff' stroke-width='2.5'/><line x1='-10' y1='0' x2='10' y2='0' stroke='%23ffffff' stroke-width='3' stroke-linecap='round'/><text x='0' y='46' fill='%23a1a1aa' font-family='sans-serif' font-size='13' font-weight='600' text-anchor='middle'>-q₂</text></g><line x1='130' y1='80' x2='370' y2='80' stroke='%23ffffff' stroke-width='2' stroke-dasharray='4 4' marker-start='url(%23arrow-left)' marker-end='url(%23arrow-right)'/><rect x='235' y='62' width='30' height='36' fill='%2318181b' rx='6'/><text x='250' y='86' fill='%23ffffff' font-family='sans-serif' font-size='18' font-style='italic' font-weight='bold' text-anchor='middle'>r</text></svg>",
          alt: {
            EN: "Binomial probability distribution graph (Advanced)",
            FR: "Graphique de distribution de probabilité binomiale (Avancé)"
          }
        }
      },
      scenarioData: {
        beginner: {
          text: { 
            EN: "In a behavioral ecology study, a sample of eight foxes are subjected to a conditioning protocol hypothesized to yield a 60% success rate in eliciting a target behavior. Assuming independence between trials, determine the probability that at least half of the eight foxes exhibit the conditioned response.", 
            FR: "Dans une étude d'écologie comportementale, un échantillon de huit renards est soumis à un protocole de conditionnement censé produire un comportement cible dans 60 % des cas. En supposant l'indépendance des essais, quelle est la probabilité qu'au moins la moitié des huit renards présentent la réponse conditionnée?" 
          }
        },
        intermediate: {
          text: { 
            EN: "In a clinical trial evaluating a new allergy medication, a focus group of twelve patients is monitored for adverse side effects. Historical data suggests the probability of a patient experiencing mild drowsiness under this formulation is exactly 25%. Assuming each patient's physiological reaction is independent, calculate the probability that fewer than four individuals in this sample group report experiencing drowsiness.", 
            FR: "Dans un essai clinique évaluant un nouveau médicament contre les allergies, un groupe de douze patients est suivi afin de détecter d'éventuels effets indésirables. Les données historiques suggèrent que la probabilité qu'un patient ressente une légère somnolence avec cette formulation est exactement de 25 %. En supposant que la réaction physiologique de chaque patient est indépendante, calculez la probabilité que moins de quatre individus de ce groupe rapportent une somnolence." 
          }
        },
        advanced: {
          text: { 
            EN: "An automated manufacturing line produces microchips with a known, stable defect rate of 5%. A quality control inspector randomly selects a batch of twenty microchips from the morning production run for rigorous stress testing. Under the assumption that the structural integrity of each chip is independent of the others, find the probability that the batch contains more than two defective units.", 
            FR: "Une ligne de production automatisée fabrique des microprocesseurs dont le taux de défauts est connu et stable à 5 %. Un contrôleur qualité prélève aléatoirement un lot de vingt microprocesseurs issus de la production du matin pour des tests de résistance rigoureux. En supposant que l'intégrité structurelle de chaque puce est indépendante des autres, quelle est la probabilité que le lot contienne plus de deux unités défectueuses ?" 
          }
        }
      },
      bilingualReadingData: {
        beginner: {
          sentences: {
            EN: [
              "We are testing the average weight of a species of frog.",
              "The population standard deviation is known and stable.",
              "We calculate the test statistic using the sample mean.",
              "Finally, we compare it to our critical values to make a decision."
            ],
            FR: [
              "Nous testons le poids moyen d'une espèce de grenouille.",
              "L'écart-type de la population est connu et stable.",
              "Nous calculons la statistique de test en utilisant la moyenne de l'échantillon.",
              "Enfin, nous la comparons à nos valeurs critiques pour prendre une décision."
            ]
          },
          solution: { 
            EN: "Compare Z-statistic to alpha threshold (1.96 for 95% CI).", 
            FR: "Comparez le score Z au seuil alpha (1,96 pour IC 95%)." 
          }
        },
        intermediate: {
          sentences: {
            EN: [
              "Sampling distributions reveal deviations from population norms.",
              "With large datasets, the central limit theorem justifies Z-testing.",
              "The test statistic normalizes sample error against standard deviation.",
              "Reject the null when observed variance exceeds critical bounds."
            ],
            FR: [
              "Les distributions d'échantillonnage montrent des différences dans les normes de la population.",
              "Avec des gros ensembles de données, le théorème de la limite centrale justifie le test Z.",
              "La statistique de test normalise l'erreur d'échantillonnage par rapport à l'écart-type.",
              "Rejeter le nulle lorsque la variance observée dépasse les limites critiques."
            ]
          },
          solution: { 
            EN: "Calculate Z = (x̄ - μ) / (σ/√n); evaluate against α-level distribution tails.", 
            FR: "Calculez Z = (x̄ - μ) / (σ/√n) ; évaluez par rapport aux queues de la distribution α." 
          }
        },
        advanced: {
          sentences: {
            EN: [
              "Sampling assesses deviations from the population mean.",
              "Assuming normal distribution, a Z-test is applicable.",
              "The test statistic scales sample error by standard error.",
              "Rejection occurs when the test statistic exceeds alpha boundaries."
            ],
            FR: [
              "L'échantillonnage évalue les déviations de la moyenne de la population.",
              "En supposant une distribution normale, on peut recourir à un test Z.",
              "La statistique de test met en rapport l'erreur d'échantillonnage avec l'erreur-type.",
              "Le rejet se produit lorsque la statistique de test dépasse les limites alpha."
            ]
          },
          solution: {
            EN: "Compute z = (x̄ - μ) / (σ / √n). The critical region is defined by the area in the tails of the standard normal distribution.",
            FR: "Calculez z = (x̄ - μ) / (σ / √n). La région critique est définie par l'aire dans les queues de la distribution normale centrée réduite."
          }
        }
      },
      dragDropData: {
        beginner: {
          EN: {
            prompt: "We are testing if the average weight of a certain species of frog is different from 12g. The population standard deviation is known. The sample comes from a normal distribution. The test statistic is z = -2.25. The significance level is 5%, and the critical values are -1.96 and 1.96.",
            options: ["Because", "we fail to reject the null hypothesis.", "z = -2.25", "is less than -1.96", "we reject the null hypothesis.", "There is enough evidence to", "The mean is equal to 12g.", "There is not enough evidence.", "say the mean is different from 12g."],
            correctOrder: ["Because", "z = -2.25", "is less than -1.96", "we reject the null hypothesis.", "There is enough evidence to", "say the mean is different from 12g."]
          },
          FR: {
            prompt: "Nous testons si le poids moyen d’une certaine espèce de grenouille est différent de 12 g. L’écart-type de la population est connu. L’échantillon provient d’une distribution normale. La statistique de test est z = -2,25. Le niveau de signification est de 5 %, et les valeurs critiques sont -1,96 et 1,96.",
            options: ["on rejette l’hypothèse nulle.", "Il n’y a pas assez de preuves.", "z = -2,25", "La moyenne est égale à 12 g.", "dire que la moyenne est différente de 12 g.", "on ne rejette pas l’hypothèse nulle.", "Parce que", "Il y a assez de preuves pour", "est plus petit que -1,96"],
            correctOrder: ["Parce que", "z = -2,25", "est plus petit que -1,96", "on rejette l’hypothèse nulle.", "Il y a assez de preuves pour", "dire que la moyenne est différente de 12 g."]
          }
        },
        intermediate: {
          EN: {
            prompt: "A random sample of frogs yields a sample mean. The population standard deviation is known, and the sample size is large. We want to determine whether the average weight differs from 12g. The test statistic is z = -2.25. At a significance level of 5%, the critical region is below -1.96 or above 1.96.",
            options: ["Since", "suggests no deviation from 12g.", "conclude that the population mean is not 12g.", "z = -2.25", "falls in the rejection region", "we reject H₀.", "z = 0", "There is sufficient evidence to", "We used a t-test."],
            correctOrder: ["Since", "z = -2.25", "falls in the rejection region", "we reject H₀.", "There is sufficient evidence to", "conclude that the population mean is not 12g."]
          },
          FR: {
            prompt: "Un échantillon aléatoire de grenouilles donne une moyenne observée. L’écart-type de la population est connu et la taille de l’échantillon est grande. Nous cherchons à déterminer si le poids moyen diffère de 12 g. La statistique de test est z = -2,25. Pour un seuil de 5 %, la région critique se trouve en dessous de -1,96 ou au-dessus de 1,96.",
            options: ["on rejette l’hypothèse nulle.", "Il n’y a pas assez de preuves.", "z = -2,25", "La moyenne est égale à 12 g.", "dire que la moyenne est différente de 12 g.", "on ne rejette pas l’hypothèse nulle.", "Parce que", "Il y a assez de preuves pour", "est plus petit que -1,96"],
            correctOrder: ["Puisque", "z = -2,25", "tombe dans la région critique", "on rejette H₀.", "Il y a suffisamment de preuves pour", "conclure que la moyenne de la population n’est pas 12 g."]
          }
        },
        advanced: {
          EN: {
            prompt: "A sample drawn from a population with known variance is used to assess whether the true mean weight of a frog species equals 12g. The sampling distribution of the mean is assumed normal. With a test statistic of z = -2.25 and a significance level of α = 0.05, the critical boundaries are ±1.96.",
            options: ["Given that", "z = -2.25", "lies beyond the critical boundary of -1.96", "we reject the null hypothesis (H₀).", "This supports the inference that", "μ ≠ 12g at the 5% significance level.", "z lies inside the non-critical region.", "This implies no significant deviation from μ = 12g.", "The null hypothesis cannot be rejected."],
            correctOrder: ["Given that", "z = -2.25", "lies beyond the critical boundary of -1.96", "we reject the null hypothesis (H₀).", "This supports the inference that", "μ ≠ 12g at the 5% significance level."]
          },
          FR: {
            prompt: "Un échantillon prélevé dans une population à variance connue est utilisé pour évaluer si la moyenne réelle du poids d’une espèce de grenouille est égale à 12 g. La distribution de l’échantillonnage est supposée normale. Avec une statistique de test z = -2,25 et un niveau de signification α = 0,05, les bornes critiques sont ±1,96.",
            options: ["Étant donné que", "z = -2,25", "dépasse la borne critique de -1,96", "on rejette l’hypothèse nulle (H₀).", "Cela soutient l’inférence que", " μ ≠ 12 g au niveau de signification de 5 %.", "Cela suggère l’absence de déviation significative de μ = 12 g.", "On ne peut pas rejeter l’hypothèse nulle.", "z est dans la région non critique."],
            correctOrder: ["Étant donné que", "z = -2,25", "dépasse la borne critique de -1,96", "on rejette l’hypothèse nulle (H₀).", "Cela soutient l’inférence que", "μ ≠ 12 g au niveau de signification de 5 %."]
          }
        }
      },
      dynamicProblemData: {
        beginner: {
          EN: {
            textStart: "A team of researchers is studying wild rodents. The average temperature is 38.5°C. What is the probability that a randomly selected rodent has a temperature",
            textEnd: "°C?",
            defaultNumber: 39.2,
            increment: 1.0,
            mu: 38.5,
            sigma: 0.7,
            explanationTemplates: {
              less: "The probability of getting a value with a z-score of {{z}} or less is about {{prob}}.",
              greater: "The probability of getting a value with a z-score of {{z}} or more is about {{prob}}.",
              between: "The probability of getting a value between z-scores of {{z1}} and {{z2}} is about {{prob}}."
            }
          },
          FR: {
            textStart: "Une équipe de chercheurs étudie des rongeurs sauvages. La température moyenne est de 38,5°C. Quelle est la probabilité qu'un rongeur sélectionné au hasard ait une température",
            textEnd: "°C ?",
            defaultNumber: 39.2,
            increment: 1.0,
            mu: 38.5,
            sigma: 0.7,
            explanationTemplates: {
              less: "La probabilité d'obtenir une valeur avec un score z de {{z}} ou moins est d'environ {{prob}}.",
              greater: "La probabilité d'obtenir une valeur avec un score z de {{z}} ou plus est d'environ {{prob}}.",
              between: "La probabilité d'obtenir une valeur comprise entre les scores z de {{z1}} et {{z2}} est d'environ {{prob}}."
            }
          }
        },
        intermediate: {
          EN: {
            textStart: "The body temperature of wild rodents follows a normal distribution with a mean of 38.5°C and a standard deviation of 0.7°C. What is the probability that a randomly selected rodent has a temperature",
            textEnd: "°C?",
            defaultNumber: 39.2,
            increment: 1.0,
            mu: 38.5,
            sigma: 0.7,
            explanationTemplates: {
              less: "A z-score of {{z}} corresponds to a cumulative probability of approximately {{prob}}.",
              greater: "A z-score of {{z}} corresponds to an upper tail probability of approximately {{prob}}.",
              between: "The area under the curve between z = {{z1}} and z = {{z2}} is approximately {{prob}}."
            }
          },
          FR: {
            textStart: "La température corporelle des rongeurs sauvages suit une distribution normale avec une moyenne de 38,5°C et un écart-type de 0,7°C. Quelle est la probabilité qu'un rongeur sélectionné au hasard ait une température",
            textEnd: "°C ?",
            defaultNumber: 39.2,
            increment: 1.0,
            mu: 38.5,
            sigma: 0.7,
            explanationTemplates: {
              less: "Un score z de {{z}} correspond à une probabilité cumulée d'environ {{prob}}.",
              greater: "Un score z de {{z}} correspond à une probabilité dans la queue supérieure d'environ {{prob}}.",
              between: "L'aire sous la courbe entre z = {{z1}} et z = {{z2}} est d'environ {{prob}}."
            }
          }
        },
        advanced: {
          EN: {
            textStart: "Within a population of wild rodents, core body temperature is modeled by a normal distribution with parameters μ = 38.5°C and σ = 0.7°C. Determine the probability that a randomly selected individual exhibits a temperature",
            textEnd: "°C?",
            defaultNumber: 39.2,
            increment: 1.0,
            mu: 38.5,
            sigma: 0.7,
            explanationTemplates: {
              less: "The lower tail probability for z = {{z}} evaluates to approximately {{prob}}.",
              greater: "The upper tail probability for z = {{z}} is approximately {{prob}}.",
              between: "The probability mass bounded by z ∈ [{{z1}}, {{z2}}] integrates to approximately {{prob}}."
            }
          },
          FR: {
            textStart: "Au sein d'une population de rongeurs sauvages, la température corporelle centrale est modélisée par une distribution normale avec les paramètres μ = 38,5°C et σ = 0,7°C. Déterminez la probabilité qu'un individu sélectionné au hasard présente une température",
            textEnd: "°C ?",
            defaultNumber: 39.2,
            increment: 1.0,
            mu: 38.5,
            sigma: 0.7,
            explanationTemplates: {
              less: "La probabilité de la queue inférieure pour z = {{z}} est évaluée à environ {{prob}}.",
              greater: "La probabilité de la queue supérieure pour z = {{z}} est d'environ {{prob}}.",
              between: "La masse de probabilité délimitée par z ∈ [{{z1}}, {{z2}}] s'intègre à environ {{prob}}."
            }
          }
        }
      }
    },
  ]);

  //===========================================================================================================================================
  // put the problem generation logic here (problems should be generated using the structure from the `ContentItem` interface right above this)
  const generateNewProblem = async (topicPrompt: string) => { 
    return; 
  };
  //===========================================================================================================================================

  const handleLanguageChange = (selectedLang : Language) => {
    playLanguageClick();
    setCurrentLanguage(selectedLang);
  };

  const displayTitle = () => {
    if (!currentProblem) return null;

    let specificTabTitle = undefined;

    switch (activeIndex) {
      case 0:
        specificTabTitle = currentProblem.scenarioData[difficulty].title;
        break;
      case 1:
        specificTabTitle = dragDropTask?.title;
        break;
      case 2:
        specificTabTitle = bilingualTask?.title;
        break;
      case 3:
        specificTabTitle = dynamicTask?.title;
        break;
    }
    const localizedSpecificTitle = specificTabTitle?.[currentLanguage];
    const localizedMainTitle = currentProblem.title?.[currentLanguage];

    return localizedSpecificTitle || localizedMainTitle || null;
  };

  const currentProblem = problems.length > 0 ? problems[0] : null;
  const dynamicProblemText = currentProblem ? currentProblem.scenarioData[difficulty].text[currentLanguage] : "";
  const currentGooeyItems = difficultyKeys.map(key => difficultyLabels[currentLanguage][key]);
  const dragDropTask = currentProblem?.dragDropData ? currentProblem.dragDropData[difficulty][currentLanguage] : null;
  const dynamicTask = currentProblem?.dynamicProblemData ? currentProblem.dynamicProblemData[difficulty][currentLanguage] : null;
  const bilingualTask = currentProblem?.bilingualReadingData ? currentProblem.bilingualReadingData[difficulty] : null;
  
  return (
    <div className="relative min-h-screen flex flex-col w-full overflow-x-hidden bg-black">
      <GridPattern width={60} height={60} x={-1} y={-1} className={cn("stroke-white/10 fixed inset-0 pointer-events-none")} />
      
      <div className="relative z-50 flex items-start justify-between w-full p-4 lg:p-6 shrink-0 pointer-events-none">
        <div className="pointer-events-auto">
          <CardNav
            logo={null}
            logoAlt="Stat à Stat"
            items={navItems[currentLanguage]}
            homeLabel={currentLanguage === "EN" ? "Home" : "Accueil"}
            baseColor="#272727"
            menuColor="#000000"
            buttonBgColor="#3f3f3f"
            buttonTextColor="#000000"
            ease="power3.out"
            isMobile={isMobile}
            mobileActionComponent={<LanguageToggle onChange={handleLanguageChange} />}
            onItemClick={(index: number) => {
              playMenuClick();
              setActiveIndex(index);
            }}
            defaultOpen={true}
          />
        </div>

        {!isMobile && (
          <div className="pointer-events-auto mt-1">
            <LanguageToggle onChange={handleLanguageChange} />
          </div>
        )}
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center animate-fade-in pb-65">
        
        <div className="w-full flex-grow flex flex-col items-center justify-center">
          <div className="mt-20 lg:mt-24" />
          {activeIndex !== null && (
            <div className="w-full max-w-5xl mx-auto">
              
              {displayTitle() && (
                <div className="relative w-full max-w-4xl mx-auto flex justify-start md:justify-center mb-8 lg:mb-10 px-4 md:px-0">
                  
                  {/* TITLE */}
                  <h1 className={cn("text-xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-tight bg-clip-text bg-gradient-to-b from-white to-zinc-400 pr-24 md:pr-0", inter.className)}>
                    {displayTitle()}
                  </h1>
                  
                  {/* CONTROLS */}
                  <div className="absolute right-4 md:right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 whitespace-nowrap">
                    
                    {/* Options Menu Dropdown */}
                    {showAudioOptions && (
                      <div className="absolute top-12 right-0 bg-zinc-900/95 border border-zinc-700/50 rounded-xl p-1.5 shadow-2xl backdrop-blur-md flex flex-col gap-1 min-w-[160px] animate-fade-in z-50">
                        <button onClick={handleRewind} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 19 2 12 11 5 11 19"></polygon>
                            <polygon points="22 19 13 12 22 5 22 19"></polygon>
                          </svg>
                          Rewind 5s
                        </button>
                        
                        <button onClick={toggleSpeed} className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-left">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                          </svg>
                          Speed: {playbackRate}x
                        </button>
                        
                        {isPlaying && (
                          <>
                            <div className="h-px w-full bg-zinc-800 my-1"></div>
                            <button onClick={stopPlayback} className="flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors text-left">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              </svg>
                              Stop Audio
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Main Play/Pause Button */}
                    <button onClick={handlePlayPause} className="p-2.5 rounded-full bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 transition-all duration-300 shadow-lg backdrop-blur-md text-zinc-300 hover:text-white group" aria-label="Play or pause audio">
                      {isPlaying && !isPaused ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                          <rect x="6" y="4" width="4" height="16"></rect>
                          <rect x="14" y="4" width="4" height="16"></rect>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                        </svg>
                      )}
                    </button>

                    {/* Options Toggle Menu Button */}
                    <button onClick={() => setShowAudioOptions(!showAudioOptions)} className="p-2.5 rounded-full bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 transition-all duration-300 shadow-lg backdrop-blur-md text-zinc-300 hover:text-white group" aria-label="Audio options">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                    </button>
                  </div> {/* End Audio Controls */}
                  
                </div>
              )}

              {/* 3. Main Content Rendering */}
              <div className="w-full">
                {(() => {
                  switch (activeIndex) {
                    case 0:
                      return (
                        <div className={inter.className}>
                          <div className="w-full max-w-4xl mx-auto bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 md:p-8 lg:p-10 shadow-xl backdrop-blur-md transition-all duration-300 animate-fade-in text-left">
                            <p className="text-zinc-300 text-base md:text-lg lg:text-xl leading-relaxed font-light tracking-wide">
                              {dynamicProblemText}
                            </p>
                          </div>
                        </div>
                      );
                    case 1:
                      return dragDropTask ? (
                        <DragDropCanvas key={`drag-${difficulty}-${currentLanguage}`} taskData={dragDropTask} language={currentLanguage} />
                      ) : (
                        <div className="text-zinc-500 py-10">Data not available</div>
                      );
                    case 2:
                      return bilingualTask ? (
                        <BilingualHighlighter key={`bilingual-${difficulty}-${currentLanguage}`} taskData={bilingualTask} currentLanguage={currentLanguage} onExpandChange={setIsBilingualExpanded} />
                      ) : (
                        <div className="text-zinc-500 py-10">Data not available</div>
                      );
                    case 3:
                      return dynamicTask ? (
                        <DynamicProblemCanvas key={`dynamic-${difficulty}-${currentLanguage}`} taskData={dynamicTask} language={currentLanguage} onTextChange={(text: string) => setCurrentDynamicText(text)} />
                      ) : (
                        <div className="text-zinc-500 py-10">Data not available</div>
                      );
                    default:
                      return null;
                  }
                })()}
              </div>

              {/* 4. Unified Collapsible Diagram Card */}
              {(() => {
                const currentDiagram = currentProblem?.diagramData?.[difficulty];
                if (!currentDiagram) return null;

                return (
                  <div className="w-full max-w-2xl mx-auto mt-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl backdrop-blur-md shadow-xl overflow-hidden transition-all duration-300">
                    {/* Card Header / Toggle Button */}
                    <button
                      onClick={() => setShowDiagram((prev) => !prev)}
                      className={cn(
                        "w-full py-3 px-5 flex items-center justify-center gap-2 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/40 transition-all duration-200 cursor-pointer",
                        inter.className,
                        showDiagram && "border-b border-zinc-800/80 bg-zinc-900/30"
                      )}
                    >
                      <span>
                        {currentLanguage === "EN" 
                          ? (showDiagram ? "Hide Diagram" : "View Diagram") 
                          : (showDiagram ? "Masquer le schéma" : "Voir le schéma")}
                      </span>
                      <span className="text-zinc-400 text-xs transition-transform duration-200">
                        {showDiagram ? "▲" : "▼"}
                      </span>
                    </button>

                    {/* Integrated Diagram Body */}
                    {showDiagram && (
                      <div className="p-6 md:p-8 flex items-center justify-center animate-fade-in">
                        <img
                          src={currentDiagram.src}
                          alt={currentDiagram.alt[currentLanguage]}
                          className="max-w-full h-auto max-h-[380px] object-contain rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}
        </div>
      </main>

      {activeIndex !== null && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto bg-black/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-zinc-800/40 shadow-2xl animate-fade-in">
          <GooeyNav 
            items={currentGooeyItems}
            onChange={(selectedLabel: string) => {
              playDifficultyClick();
              const selectedIndex = currentGooeyItems.indexOf(selectedLabel);
              if (selectedIndex !== -1) {
                setDifficulty(difficultyKeys[selectedIndex]);
              } 
            }}
          />
        </div>
      )}
    </div>
  );
};

export default App;