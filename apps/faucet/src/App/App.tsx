import React, { createContext, useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "styled-components";

import { ActionButton, Alert, Heading } from "@namada/components";
import { Namada } from "@namada/integrations";
import { ColorMode, getTheme } from "@namada/utils";

import {
  AppContainer,
  BackgroundImage,
  Banner,
  BannerContents,
  ContentContainer,
  FaucetContainer,
  GlobalStyles,
  InfoContainer,
  TopSection,
} from "App/App.components";
import { FaucetForm } from "App/Faucet";

import { chains } from "@namada/chains";
import { useUntil } from "@namada/hooks";
import { Account, AccountType } from "@namada/types";
import { API } from "utils";
import dotsBackground from "../../public/bg-dots.svg";

const DEFAULT_URL = "http://localhost:5000";
const DEFAULT_ENDPOINT = "/api/v1/faucet";
const DEFAULT_FAUCET_LIMIT = "20";

const {
  NAMADA_INTERFACE_FAUCET_API_URL: faucetApiUrl = DEFAULT_URL,
  NAMADA_INTERFACE_FAUCET_API_ENDPOINT: faucetApiEndpoint = DEFAULT_ENDPOINT,
  NAMADA_INTERFACE_FAUCET_LIMIT: faucetLimit = DEFAULT_FAUCET_LIMIT,
  NAMADA_INTERFACE_PROXY: isProxied,
  NAMADA_INTERFACE_PROXY_PORT: proxyPort = 9000,
} = process.env;

const apiUrl = isProxied ? `http://localhost:${proxyPort}/proxy` : faucetApiUrl;
const url = `${apiUrl}${faucetApiEndpoint}`;
const api = new API(url);
const limit = parseInt(faucetLimit);
const runFullNodeUrl = "https://docs.namada.net/operators/ledger";
const becomeBuilderUrl = "https://docs.namada.net/integrating-with-namada";

type Settings = {
  difficulty?: number;
  tokens?: Record<string, string>;
  startsAt: number;
  startsAtText?: string;
};

type AppContext = Settings & {
  limit: number;
  url: string;
  settingsError?: string;
  api: API;
};

const START_TIME_UTC = 1702918800;
const START_TIME_TEXT = new Date(START_TIME_UTC * 1000).toLocaleString(
  "en-gb",
  {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }
);

const defaults = {
  startsAt: START_TIME_UTC,
  startsAtText: `${START_TIME_TEXT} UTC`,
};

export const AppContext = createContext<AppContext>({
  ...defaults,
  limit,
  url,
  api,
});

enum ExtensionAttachStatus {
  PendingDetection,
  NotInstalled,
  Installed,
}

export const App: React.FC = () => {
  const initialColorMode = "dark";
  const chain = chains.namada;
  const integration = new Namada(chain);
  const [extensionAttachStatus, setExtensionAttachStatus] = useState(
    ExtensionAttachStatus.PendingDetection
  );
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [colorMode, _] = useState<ColorMode>(initialColorMode);
  const [isTestnetLive, setIsTestnetLive] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    ...defaults,
  });
  const [settingsError, setSettingsError] = useState<string>();
  const theme = getTheme(colorMode);

  useUntil(
    {
      predFn: async () => Promise.resolve(integration.detect()),
      onSuccess: () => {
        setExtensionAttachStatus(ExtensionAttachStatus.Installed);
      },
      onFail: () => {
        setExtensionAttachStatus(ExtensionAttachStatus.NotInstalled);
      },
    },
    { tries: 5, ms: 300 },
    [integration]
  );

  useEffect(() => {
    const { startsAt } = settings;
    const now = new Date();
    const nowUTC = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes()
    );
    const startsAtToMilliseconds = startsAt * 1000;
    if (nowUTC < startsAtToMilliseconds) {
      setIsTestnetLive(false);
    }

    // Fetch settings from faucet API
    (async () => {
      try {
        const { difficulty, tokens_alias_to_address: tokens } = await api
          .settings()
          .catch((e) => {
            const message = e.errors?.message;
            setSettingsError(
              `Error requesting settings: ${message?.join(" ")}`
            );
            throw new Error(e);
          });
        // Append difficulty level and tokens to settings
        setSettings({
          ...settings,
          difficulty,
          tokens,
        });
      } catch (e) {
        // setSettingsError(`Failed to load settings! ${e}`);
        setSettingsError(
          `Failed to connect pool, please reload the page! ${e}`
        );
      }
    })();
  }, []);

  const handleConnectExtensionClick = useCallback(async (): Promise<void> => {
    if (integration) {
      try {
        const isIntegrationDetected = integration.detect();

        if (!isIntegrationDetected) {
          throw new Error("Extension not installed!");
        }

        await integration.connect();
        const accounts = await integration.accounts();
        if (accounts) {
          setAccounts(
            accounts.filter(
              (account) =>
                !account.isShielded && account.type !== AccountType.Ledger
            )
          );
        }
        setIsExtensionConnected(true);
      } catch (e) {
        console.error(e);
      }
    }
  }, [integration]);

  return (
    <AppContext.Provider
      value={{
        settingsError,
        limit,
        url,
        api,
        ...settings,
      }}
    >
      <BackgroundImage imageUrl={dotsBackground} />
      <ThemeProvider theme={theme}>
        {!isTestnetLive && settings?.startsAtText && (
          <Banner>
            <BannerContents>
              Testnet will go live {settings.startsAtText}! Faucet is disabled
              until then.
            </BannerContents>
          </Banner>
        )}
        <GlobalStyles colorMode={colorMode} />
        <AppContainer>
          <ContentContainer>
            <TopSection>
              <Heading
                className="uppercase text-neutral-800 text-4xl font-bold"
                level="h1"
              >
                Namada Shielded Expedition Faucet
              </Heading>
            </TopSection>
            <FaucetContainer>
              {extensionAttachStatus ===
                ExtensionAttachStatus.PendingDetection && (
                <InfoContainer>
                  <Alert type="info">Loading extension wallet...</Alert>
                </InfoContainer>
              )}
              {extensionAttachStatus === ExtensionAttachStatus.NotInstalled && (
                <InfoContainer>
                  <Alert type="error">You must download the extension!</Alert>
                </InfoContainer>
              )}
              {isExtensionConnected && (
                <FaucetForm
                  accounts={accounts}
                  integration={integration}
                  isTestnetLive={isTestnetLive}
                />
              )}
              {extensionAttachStatus === ExtensionAttachStatus.Installed &&
                !isExtensionConnected && (
                  <InfoContainer>
                    <div className="text-white font-medium text-2xl px-1 text-center pb-4">
                      Are you running out of NAAN?
                    </div>

                    <ActionButton
                      onClick={handleConnectExtensionClick}
                      style={{
                        fontSize: "1.25rem",
                        lineHeight: "1.6",
                        padding: "0.6em 2.5em",
                        margin: 0,
                        width: "100%",
                      }}
                      // className="max-w-fit"
                      color="secondary"
                      borderRadius="md"
                    >
                      Connect to Namada Wallet Extension
                    </ActionButton>
                    <div className="font-medium flex flex-col px-1 pb-3 pt-5">
                      <h1 className="text-white mr-2">Note:</h1>
                      <span className="italic text-white text-md px-5">
                        1. Maximum limit is 20 NAAN at a time.
                      </span>
                      <span className="italic text-white text-md px-5">
                        2. If the faucet is successfully, come back after 24
                        hours.
                      </span>
                      <span className="italic text-white text-md px-5">
                        3. If the faucet is failed, it looks like there is no
                        more NAAN in the pool, so come back in 24 hours.
                      </span>
                    </div>
                  </InfoContainer>
                )}
            </FaucetContainer>
            {/* <BottomSection> */}
            {/* <CardsContainer>
                <CallToActionCard
                  description="Contribute to the Namada network's resiliency"
                  title="RUN A FULL NODE"
                  href={runFullNodeUrl}
                />
                <CallToActionCard
                  description="Integrate Namada into applications or extend its capabilities"
                  title="BECOME A BUILDER"
                  href={becomeBuilderUrl}
                />
              </CardsContainer> */}
            {/* <Faq /> */}
            {/* </BottomSection> */}
            {/* <BackgroundImage imageUrl={dotsBackground} /> */}
          </ContentContainer>
        </AppContainer>
      </ThemeProvider>
    </AppContext.Provider>
  );
};
