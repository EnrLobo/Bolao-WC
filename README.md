# Documentação Técnica: Bolão Copa do Mundo 2026

## 1. Visão Geral e Finalidade
O **Bolão Copa do Mundo 2026** é um aplicativo web projetado para a criação e gerenciamento de grupos (parties) de apostas recreativas entre amigos para o torneio da FIFA. Sua finalidade principal é automatizar o fluxo de um bolão: o sistema gerencia participantes, coleta palpites, processa os resultados reais dos 104 jogos e calcula o ranking dinamicamente com base em placares exatos, acertos de time vencedor ou erros, substituindo planilhas manuais por uma interface interativa.

## 2. Arquitetura do Sistema
O projeto adota uma arquitetura **Serverless SPA (Single Page Application)**. Isso significa que ele não depende de um servidor backend tradicional (como Node.js, Python ou PHP) para processar as telas. Toda a lógica de apresentação e regras de negócio está no lado do cliente (navegador do usuário).

### Padrão de Armazenamento Híbrido
O módulo de estado (`store.js`) foi desenvolvido com um padrão estrutural que permite trabalhar com duas frentes de banco de dados, sem que a interface principal saiba a diferença:
* **LocalStore:** Utiliza o `localStorage` do navegador. Ideal para desenvolvimento rápido ou para rodar o aplicativo de forma offline e isolada, sem necessidade de chaves externas.
* **FirebaseStore:** Utiliza o **Cloud Firestore**. Funciona como o modelo oficial de produção, sincronizando em tempo real a criação de parties, autenticação e salvamento de palpites entre todos os dispositivos.

### Gerenciamento de Interface
O aplicativo não utiliza frameworks front-end como React, Vue ou Angular. Toda a manipulação do DOM (Document Object Model) é feita com **JavaScript Vanilla (ES6 Modules)**. O arquivo `app.js` age como o orquestrador (Controller) das ações do usuário, injetando fragmentos de código HTML via Template Literals conforme o estado atual da aplicação muda.

## 3. Tecnologias Utilizadas
As ferramentas foram escolhidas visando extrema leveza, execução imediata pelo navegador e hospedagem estática otimizada.
* **Frontend Estático e Sem Bundlers:** HTML5, CSS3, JavaScript (ES6+). Código modular e direto, sem o uso de empacotadores como Webpack ou dependências NPM (sem `package.json`).
* **Integração via Fetch API:** O aplicativo consome os dados oficiais dos 104 jogos em formato JSON hospedados no repositório público do OpenFootball.
* **Backend as a Service (BaaS):** Firebase Auth e Cloud Firestore. O Firebase centraliza a segurança através do `firestore.rules`, evitando que participantes editem pontuações ou palpites de concorrentes.
* **Hospedagem:** Vercel.

## 4. Estrutura de Dados (NoSQL)
Os dados na nuvem (Firestore) estão divididos em coleções otimizadas para consultas independentes e bloqueios de segurança por ID:
* `/users/{uid}`: Informações de perfil de cada participante.
* `/parties/{partyId}`: A sala do bolão, com seu código gerado, dono (Owner) e configurações de pontuação.
* **Subcoleção `matches`**: A tabela oficial copiada para a party. O dono do grupo pode lançar os resultados oficiais dos jogos aqui.
* **Subcoleção `predictions`**: O palpite individual de cada pessoa por jogo, salvo de forma relacional usando uma chave combinada (ex: `{uid}_{matchId}`).

## 5. Como Rodar o Projeto

### Modo Local (Teste Rápido)
Por ser 100% estático, você pode executar o aplicativo imediatamente utilizando um servidor HTTP simples em sua máquina. Usando o terminal na pasta do projeto:
```bash
python -m http.server 3000
