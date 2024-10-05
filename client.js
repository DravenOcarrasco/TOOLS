(async function () {
    /**
     * Function to create a module context with WebSocket, storage, and custom data capabilities.
     * This function returns a context object with methods that allow interaction with WebSocket events, 
     * storage, and custom data management.
     *
     * @param {string} moduleName - The name of the module.
     * @returns {{
    *   MODULE_NAME: string,
    *   SOCKET: object,
    *   KEYBOARD_COMMANDS: Array<object>,
    *   setStorage: (key: string, value: any, isGlobal: boolean) => Promise<object>,
    *   getStorage: (key: string, isGlobal: boolean) => Promise<object>,
    *   getVariable: (variableName: string, defaultValue: any, create: boolean, isGlobal: boolean) => Promise<any>,
    *   showMenu: (options: Array<object>) => void,
    *   getCustomData: (key: string) => any,
    *   setCustomData: (key: string, value: any) => void
    *   setMenuHandler: (handlerFunction: function) => void
    * }} - The context object with methods for WebSocket, storage, and custom data.
   */
    function createContext(moduleName) {
        return window.WSACTION.createModuleContext(moduleName);
    }

    const MAX_RAMDOM_TIME = 7000;

    // Criar o contexto para o módulo utilizando a função createModuleContext
    const CONTEXT = createContext("TOOLS");
    
    const DEFAULT_MAX_DELAY = 1000;

    const SOCKET = CONTEXT.SOCKET;
    CONTEXT.KEYBOARD_COMMANDS = [
        {
            description: "Toggle Master session",
            keys: [ 
                {
                    key: "control", 
                    upercase: false
                },
                {
                    key: "m", 
                    upercase: false
                }
            ],
        },
        {
            description: "Master Actions Menu",
            keys: [ 
                {
                    key: "control", 
                    upercase: false
                },
                {
                    key: "alt", 
                    upercase: false
                },
                {
                    key: "n", 
                    upercase: false
                }
            ],
        }
    ]

    let isMaster = false; // Variável para controlar se o cliente é o mestre
    let maxDelay = DEFAULT_MAX_DELAY; // Tempo máximo de atraso em milissegundos, valor padrão
    const actionQueue = []; // Fila de ações
    let isProcessing = false; // Variável para verificar se a fila está sendo processada
    let isExecuting = false; // Variável para verificar se uma ação replicada está sendo executada

     // Função para processar a fila de ações
     function processActionQueue() {
        if (actionQueue.length === 0) {
            isProcessing = false; // Fila vazia, definir isProcessing como falso
            return;
        }

        isProcessing = true; // Iniciar processamento
        const { payload } = actionQueue.shift();
        const delay = Math.floor(Math.random() * maxDelay); // Atraso aleatório entre 1 e maxDelay segundos

        setTimeout(() => {
            isExecuting = true;
            executeReplicatedAction(payload);
            isExecuting = false;
            processActionQueue(); // Processar próxima ação na fila
        }, delay);
    }

    // Função para enviar comandos
    function sendCommand(command, data) {
        if (isMaster) {
            SOCKET.emit(`${CONTEXT.MODULE_NAME}.master:command`, { command, data });
        } else {
            console.log('Este cliente não é o mestre.');
        }
    }

    // Função para capturar ações e enviá-las ao servidor
    function captureAction(event) {
        
        // Verifica se o alvo do evento (elemento de input) tem o atributo 'data-programmatically-changed'
        if (event.target && event.target.hasAttribute('data-programmatically-changed')) {
            // Remove o atributo 'data-programmatically-changed'
            event.target.removeAttribute('data-programmatically-changed');
            return;
        }

        if(event && event.detail && event.detail.ignore){
            return
        }

        if (isMaster && !isExecuting) {
            const element = event.target;
            const tagName = element.tagName;
            const action = event.type;
            const value = element.value;
            const selector = getElementXPath(element);
            sendCommand('replicateAction', { tagName, action, value, selector });
        }
    }

    // Função para obter o XPath de um elemento
    function getElementXPath(element) {
        const paths = [];
        for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
            let index = 0;
            for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
                if (sibling.nodeName === element.nodeName) ++index;
            }
            const tagName = element.nodeName.toLowerCase();
            const pathIndex = index ? `[${index + 1}]` : '';
            paths.unshift(`${tagName}${pathIndex}`);
        }
        return paths.length ? `/${paths.join('/')}` : null;
    }
    
    let masterKeydownListener;

    // Função para adicionar/remover o texto de mestre
    function toggleMasterText(isMaster) {
        const masterTextId = 'master-text';
        let masterText = document.getElementById(masterTextId);

        if (isMaster) {
            if (!masterText) {
                masterText = document.createElement('div');
                masterText.id = masterTextId;
                masterText.innerText = 'Mestre';
                masterText.style.position = 'fixed';
                masterText.style.top = '10px';
                masterText.style.right = '10px';
                masterText.style.backgroundColor = 'yellow';
                masterText.style.padding = '5px';
                masterText.style.zIndex = '1000000';
                document.querySelector('html').appendChild(masterText);
            } else {
                masterText.innerText = 'Mestre';
                masterText.style.backgroundColor = 'yellow';
            }

            // Adiciona evento de teclas "Control + Alt + M" para abrir o menu se for mestre
            if (!masterKeydownListener) {
                masterKeydownListener = (e) => {
                    if (e.ctrlKey && e.altKey && e.key === 'n') {
                        openMasterMenu();
                    }
                };
                document.addEventListener('keydown', masterKeydownListener);
            }

        } else {
            if (!masterText) {
                masterText = document.createElement('div');
                masterText.id = masterTextId;
                masterText.innerText = 'Escravo';
                masterText.style.position = 'fixed';
                masterText.style.top = '10px';
                masterText.style.right = '10px';
                masterText.style.backgroundColor = 'lightgray';
                masterText.style.padding = '5px';
                masterText.style.zIndex = '1000000';
                document.querySelector('html').appendChild(masterText);
            } else {
                masterText.innerText = 'Escravo';
                masterText.style.backgroundColor = 'lightgray';
            }

            // Remove o evento de "keydown" se não for mais mestre
            if (masterKeydownListener) {
                document.removeEventListener('keydown', masterKeydownListener);
                masterKeydownListener = null;
            }
        }
    }

    // Função para abrir o menu do "Mestre" com SweetAlert2
    function openMasterMenu() {
        Swal.fire({
            title: 'Menu do Mestre',
            width: '80vw', // 80% da largura da viewport
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
                    <div style="display: flex; justify-content: space-around; width: 100%; margin-top: 20px;">
                        <button id="reload-all-pages" class="swal2-confirm swal2-styled" style="
                            flex: 1;
                            max-width: 300px;
                            padding: 15px;
                            background-color: #f44336;
                            color: white;
                            border-radius: 5px;
                            font-size: 16px;
                            border: none;
                            cursor: pointer;
                            transition: background-color 0.3s ease;
                            margin-right: 10px;
                        ">🔄 Recarregar Conexões</button>
                        <button id="open-new-page" class="swal2-confirm swal2-styled" style="
                            flex: 1;
                            max-width: 300px;
                            padding: 15px;
                            background-color: #4CAF50;
                            color: white;
                            border-radius: 5px;
                            font-size: 16px;
                            border: none;
                            cursor: pointer;
                            transition: background-color 0.3s ease;
                        ">🌐 Navegar para Página</button>
                    </div>
                </div>
            `,
            showCloseButton: true,
            showConfirmButton: false,
            didOpen: () => {
                // Adiciona eventos de clique para os botões após o modal ser aberto
                document.getElementById('reload-all-pages').addEventListener('click', reloadAllPages);
                document.getElementById('open-new-page').addEventListener('click', openNewPage);
            }
        });
    }        

    // Função para recarregar todas as páginas abertas
    function reloadAllPages() {
        Swal.fire({
            title: 'Confirmação',
            text: 'Você tem certeza que deseja recarregar todas as páginas abertas?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, recarregar!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                sendCommand('browser:reloadPage', {})
            }
        });
    }

    // Função para abrir uma nova página
    function openNewPage() {
        Swal.fire({
            title: 'Abrir Nova Página',
            input: 'text',
            inputLabel: 'Digite a URL da página que deseja abrir:',
            inputPlaceholder: 'https://',
            showCancelButton: true,
            confirmButtonText: 'Abrir',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                sendCommand('browser:openPage', {payload: result.value})
            }
        });
    }

    async function toggleMasterStatus() {
        isMaster = !isMaster;
        await CONTEXT.setStorage('isMaster', isMaster);
        toggleMasterText(isMaster);
        if (isMaster) {
            Swal.fire('Mestre', 'Este cliente agora é o mestre.', 'success');
            const button = document.querySelector('button#master-button');
            if (button) button.remove();
        } else {
            Swal.fire('Mestre', 'Este cliente não é mais o mestre.', 'warning');
            addMasterControlButton();
        }
    }

    // Função para adicionar o botão de controle mestre após 10 segundos
    function addMasterControlButton() {
        setTimeout(() => {
            const button = document.createElement('button');
            button.id = 'master-button';
            button.className = 'btn btn-primary'; // Classe Bootstrap para estilizar o botão
            button.innerText = 'Tornar-se Mestre';
            button.style.position = 'fixed';
            button.style.bottom = '10px';
            button.style.right = '10px';
            button.style.zIndex = 1000;
            button.addEventListener('click', toggleMasterStatus);
            document.body.appendChild(button);
        }, 10000);
    }

    SOCKET.on('connect', async () => {
        console.log('Conectado ao servidor WebSocket');

        CONTEXT.getVariable('maxDelay', DEFAULT_MAX_DELAY, true).then(value => {
            maxDelay = value;
        });

        // Verifica se o cliente já é mestre e ajusta o estado
        isMaster = await CONTEXT.getVariable('isMaster', false, true);
        if (isMaster) {
            toggleMasterText(true);
        } else {
            addMasterControlButton();
        }

        // Recebe comandos do mestre e do servidor
        SOCKET.on(`${CONTEXT.MODULE_NAME}:command`, (data) => {
            if (!data) return;
            const { command, data: payload } = data;
            if (command === 'browser:openPage') {
                setTimeout(()=>{
                    if(data.data){
                        data = data.data
                    }
                    window.location.href = data.payload;
                }, Math.floor(Math.random() * MAX_RAMDOM_TIME))
            } else if (command === 'browser:reloadPage') {
                setTimeout(()=>{
                    window.location.reload();
                }, Math.floor(Math.random() * MAX_RAMDOM_TIME))
            } else if (command === 'global:control') {
                executeGlobalControl(payload);
            } else if (command === 'button:click') {
                clickButton(payload);
            } else if (command === 'replicateAction') {
                if (!payload) return;
                if (isMaster) return;
                actionQueue.push({ payload });
                if (!isProcessing) processActionQueue(); // Inicia o processamento se a fila não estiver sendo processada
            } else if (command === 'setMaxDelay') {
                maxDelay = payload;
                CONTEXT.setStorage('maxDelay', maxDelay).then(() => {
                    Swal.fire('Atualizado!', `Novo tempo máximo de atraso definido para ${maxDelay / 1000} segundos.`, 'success');
                });
            }
        });
    });

    SOCKET.on('disconnect', () => {
        console.log('Desconectado do servidor WebSocket');
    });

    function executeGlobalControl(data) {
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea');
        inputs.forEach((input, index) => {
            input.value = data || `Valor ${index}`;
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        });
        console.log('Inputs preenchidos.');
    }

    function clickButton(selector) {
        const button = document.querySelector(selector);
        if (button) {
            button.click();
            console.log(`Botão com o seletor "${selector}" foi clicado.`);
        } else {
            console.log(`Botão com o seletor "${selector}" não foi encontrado.`);
        }
    }

    function executeReplicatedAction(payload) {
        const { selector, action, value } = payload;
        console.log(`Tentando executar ação: ${action} em ${selector}`);
        const element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (element) {
            console.log(`Elemento encontrado: ${element.tagName}`);
            if (action === 'click') {
                element.click();
            } else if (action === 'input' || 'change') {
                element.value = value;
                element.dispatchEvent(new Event(action, { bubbles: true }));
            }
            console.log(`Ação replicada: ${action} em ${selector}`);
        } else {
            console.log(`Elemento não encontrado para replicar a ação: ${selector}`);
        }
    }

    // Adiciona evento de teclado para tornar-se mestre com Ctrl+M e definir atraso máximo com Ctrl+D
    document.addEventListener('keydown', async (event) => {
        if (event.ctrlKey && event.key === 'm') {
            await toggleMasterStatus();
        } else if (isMaster && event.ctrlKey && event.key === 'Enter') {
            sendCommand('global:control', 'Valor de exemplo');
        } else if (isMaster && event.ctrlKey && event.key === 'b') {
            // Enviar comando para clicar em um botão com um seletor específico
            const selector = 'button.exemplo'; // Troque pelo seletor do botão que deseja controlar
            sendCommand('button:click', selector);
        } else if (event.ctrlKey && event.key === 'd') {
            Swal.fire({
                title: 'Definir atraso máximo',
                input: 'number',
                inputLabel: 'Digite o novo tempo máximo de atraso em segundos',
                inputValue: maxDelay * 1000,
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value || isNaN(value) || value <= 0) {
                        return 'Por favor, insira um valor válido!';
                    }
                    return null;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    maxDelay = parseInt(result.value) * 1000;
                    CONTEXT.setStorage('maxDelay', maxDelay);
                    Swal.fire('Atualizado!', `Novo tempo máximo de atraso definido para ${maxDelay / 1000} segundos.`, 'success');
                    sendCommand('setMaxDelay', maxDelay);
                }
            });
        }
    });

    // Captura ações de clique e mudança de valor em elementos de input
    document.addEventListener('click', captureAction, true);
    document.addEventListener('input', captureAction, true);
    document.addEventListener('change', captureAction, true);


    // Registro da extensão no contexto global
    if (window.extensionContext) {
        window.extensionContext.addExtension(CONTEXT.MODULE_NAME, {
            location: window.location,
            ...CONTEXT
        });
    }
})();
