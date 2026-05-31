---
project: "10xCards"
version: 1
status: draft
created: 2026-05-31
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Student uczący się regularnie (studia, matura, egzaminy) dysponuje dużymi partiami materiału tekstowego — notatki z wykładów, podręczniki, artykuły. Wie, że spaced repetition działa, ale ręczne tworzenie wysokiej jakości fiszek w Anki zajmuje tyle czasu, że rezygnuje z metody zanim zacznie przynosić efekty.

Narzędzia takie jak Anki są doskonałe w algorytmie powtórek, ale całkowicie przerzucają ciężar tworzenia treści na użytkownika. Quizlet oferuje gotowe zestawy, ale dopasowanie cudzych fiszek do własnego materiału jest nieefektywne. Brakuje narzędzia, które zamknie cały przepływ: wklej tekst → dostań dobre fiszki → zacznij powtarzać od razu.

## User & Persona

**Student** — osoba ucząca się regularnie w kontekście formalnym (studia, matura) lub nieformalnym, dysponująca tekstem do przyswojenia. Zna metodę spaced repetition i jest zmotywowana do jej stosowania, ale bariera wejścia (tworzenie fiszek) przewyższa postrzeganą wartość na tyle, że odpuszcza.

## Success Criteria

### Primary
- Użytkownik może w jednej sesji: zarejestrować się, wkleić tekst, otrzymać wygenerowane przez AI fiszki, zaakceptować lub edytować je, a następnie rozpocząć sesję powtórek — wszystko bez opuszczania aplikacji.

### Secondary
- 75% fiszek wygenerowanych przez AI jest akceptowane przez użytkownika bez edycji lub z minimalną edycją.
- 75% fiszek w systemie pochodzi z generowania AI (nie z ręcznego tworzenia).

### Guardrails
- Fiszki użytkownika nie mogą zniknąć ani zostać utracone — utrata danych dyskwalifikuje narzędzie do nauki.
- AI informuje użytkownika o ryzyku halucynacji / braku pewności co do wygenerowanej treści; użytkownik nie trafi na fałszywe fakty bez ostrzeżenia.
- Sesja powtórek działa w pełni nawet gdy usługa generowania fiszek jest niedostępna — core użyteczność nie zależy od zewnętrznego serwisu.

## User Stories

### US-01: Student generuje fiszki z notatek i zaczyna powtórki

- **Given** zalogowany użytkownik bez żadnych fiszek w systemie
- **When** wkleja tekst notatek z wykładu i zleca generowanie
- **Then** otrzymuje listę fiszek do przeglądu, akceptuje je i natychmiast może rozpocząć sesję powtórek

#### Acceptance Criteria
- Wygenerowane fiszki są widoczne do przeglądu przed zapisem
- Użytkownik może zaakceptować całość jednym kliknięciem lub edytować/usunąć poszczególne
- Po akceptacji fiszki trafiają do systemu i od razu są dostępne w sesji powtórek

## Functional Requirements

### Autentykacja
- FR-001: Użytkownik może zarejestrować się i zalogować do aplikacji (email + hasło lub OAuth). Priority: must-have
  > Socrates: Brak kontrargumentu — fiszki są persystentne i per-user; auth jest architektonicznie konieczny. FR stoi bez zmian.

### Generowanie fiszek
- FR-002: Użytkownik może wkleić dowolny tekst i zlecić AI wygenerowanie zestawu fiszek na jego podstawie. Priority: must-have
  > Socrates: Brak kontrargumentu — AI generation to core hipoteza produktu; bez niej nie ma co testować. FR stoi bez zmian.
- FR-003: Użytkownik może przejrzeć fiszki wygenerowane przez AI, zaakceptować je zbiorczo lub edytować / usunąć pojedyncze przed zapisem. Priority: must-have
  > Socrates: Brak kontrargumentu — review przed zapisem jest guardrailem przed złymi fiszkami i konieczny do pomiaru kryterium 75% akceptacji. FR stoi bez zmian.

### Tworzenie ręczne
- FR-004: Użytkownik może ręcznie utworzyć fiszkę (przód + tył) bez użycia AI. Priority: must-have
  > Socrates: Brak kontrargumentu — ręczne tworzenie jest siatką bezpieczeństwa gdy AI zawodzi lub temat jest zbyt specyficzny. FR stoi bez zmian.

### Zarządzanie fiszkami
- FR-006: Użytkownik może edytować i usuwać zapisane fiszki. Priority: must-have
  > Socrates: Brak kontrargumentu — edycja i usuwanie to podstawowe operacje; brak spowoduje frustrację gdy AI wygeneruje błąd. FR stoi bez zmian.

### Powtórki
- FR-005: Użytkownik może przeprowadzić sesję powtórek swoich fiszek opartą na gotowym algorytmie spaced repetition. Priority: must-have
  > Socrates: Brak kontrargumentu — spaced repetition to core wartość aplikacji; bez niego to notatnik. FR stoi bez zmian.

## Non-Functional Requirements

- Generowanie fiszek jest postrzegane przez użytkownika jako szybkie: wyniki pojawiają się w ciągu < 10 sekund dla typowego tekstu (akapit do ~2000 znaków).
- Sesja powtórek jest w pełni dostępna niezależnie od dostępności usługi generowania fiszek — core użyteczność nie jest blokowana przez zewnętrzny serwis.
- Treść fiszek użytkownika jest prywatna i dostępna wyłącznie dla właściciela konta.
- Aplikacja działa poprawnie na trzech głównych przeglądarkach desktop w aktualnych wersjach.

## Business Logic

Algorytm decyduje kiedy pokazać użytkownikowi daną fiszkę, optymalizując długoterminowe zapamiętywanie przy minimalnej liczbie powtórek.

Wejście reguły: wynik oceny użytkownika po każdej powtórce fiszki (np. skala trudności: łatwa / trudna / nie pamiętam). Dane historyczne: kiedy fiszka była ostatnio pokazana i jak była oceniana.

Wyjście widoczne dla użytkownika: kolejność fiszek w sesji powtórek jest wyznaczana przez algorytm — użytkownik nie decyduje sam, kiedy powtórzyć każdą fiszkę. Algorytm jest standardowym gotowym rozwiązaniem; własna implementacja algorytmu powtórek jest poza zakresem MVP.

## Access Control

Użytkownik loguje się przez email + hasło lub OAuth. Płaski model uprawnień — każdy zalogowany użytkownik widzi i zarządza wyłącznie swoimi fiszkami. Brak ról pomocniczych w MVP.

## Non-Goals

- **Własny algorytm powtórek** — własna implementacja algorytmu spaced repetition jest poza zakresem MVP; używamy gotowego rozwiązania. Budowa własnego to osobny, wielomiesięczny projekt.
- **Import plików (PDF, DOCX, itp.)** — MVP obsługuje tylko wklejony tekst (copy-paste). Import formatów binarnych to oddzielna funkcja z własnymi zależnościami.
- **Współdzielenie zestawów fiszek między użytkownikami** — fiszki są prywatne per-account. Funkcje społecznościowe i udostępnianie to zakres v2.
- **Aplikacja mobilna (iOS / Android)** — MVP działa wyłącznie w przeglądarce na desktop. Mobile to oddzielna platforma i oddzielna decyzja.
- **Integracje z platformami edukacyjnymi** — zero integracji zewnętrznych poza usługą generowania fiszek; brak konektorów do Moodle, Canvas, LMS lub innych platform.

## Open Questions

*Brak otwartych pytań — wszystkie elementy zostały rozstrzygnięte podczas sesji /10x-shape.*
