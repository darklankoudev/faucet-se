import LinearProgress from "@mui/material/LinearProgress";
import { ActionButton, Alert, AmountInput, Select } from "@namada/components";
import { Namada } from "@namada/integrations";
import { Account } from "@namada/types";
import { bech32mValidation, shortenAddress } from "@namada/utils";
import BigNumber from "bignumber.js";
import { sanitize } from "dompurify";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { TransferResponse, computePowSolution } from "../utils";
import { AppContext } from "./App";
import { InfoContainer } from "./App.components";
import {
  ButtonContainer,
  FaucetFormContainer,
  FormStatus,
  InputContainerAccount,
  InputContainerAmount,
} from "./Faucet.components";

enum Status {
  Pending,
  Completed,
  Error,
}

type Props = {
  accounts: Account[];
  integration: Namada;
  isTestnetLive: boolean;
};

const bech32mPrefix = "tnam";

export const FaucetForm: React.FC<Props> = ({
  accounts,
  integration,
  isTestnetLive,
}) => {
  const { api, difficulty, settingsError, limit, tokens } =
    useContext(AppContext);

  const accountLookup = accounts.reduce(
    (acc, account) => {
      acc[account.address] = account;
      return acc;
    },
    {} as Record<string, Account>
  );
  const [account, setAccount] = useState<Account>(accounts[0]);
  const [tokenAddress, setTokenAddress] = useState<string>();
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState(Status.Completed);
  const [statusText, setStatusText] = useState<string | JSX.Element>();
  const [responseDetails, setResponseDetails] = useState<TransferResponse>();
  const accountsSelectData = accounts.map(({ alias, address }) => ({
    label: `${alias} -- ${shortenAddress(address)}`,
    value: address,
  }));

  useEffect(() => {
    if (tokens?.NAAN) {
      setTokenAddress(tokens.NAAN);
    }
  }, [tokens]);

  const isFormValid: boolean =
    Boolean(tokenAddress) &&
    Boolean(amount) &&
    (amount || 0) <= limit &&
    Boolean(account) &&
    status !== Status.Pending &&
    typeof difficulty !== "undefined" &&
    isTestnetLive;

  const handleSubmit = useCallback(async () => {
    if (
      !account ||
      !amount ||
      !tokenAddress ||
      typeof difficulty === "undefined"
    ) {
      console.error("Please provide the required values!");
      return;
    }

    // Validate target and token inputs
    const sanitizedToken = sanitize(tokenAddress);

    if (!sanitizedToken) {
      setStatus(Status.Error);
      setError("Invalid token address!");
      return;
    }

    if (!account) {
      setStatus(Status.Error);
      setError("No account found!");
      return;
    }

    if (!bech32mValidation(bech32mPrefix, sanitizedToken)) {
      setError("Invalid bech32m address for token address!");
      setStatus(Status.Error);
      return;
    }
    setStatus(Status.Pending);
    setStatusText(undefined);

    try {
      if (!account.publicKey) {
        throw new Error("Account does not have a public key!");
      }

      const { challenge, tag } = await api
        .challenge(account.publicKey)
        .catch(({ message }) => {
          throw new Error(`${message}`);
        });

      const solution = computePowSolution(challenge, difficulty || 0);

      const signer = integration.signer();
      if (!signer) {
        throw new Error("Signer not defined");
      }

      const sig = await signer.sign(account.address, challenge);
      if (!sig) {
        throw new Error("Signature was rejected");
      }

      const submitData = {
        solution,
        tag,
        challenge,
        player_id: account.publicKey,
        challenge_signature: sig.signature,
        transfer: {
          target: account.address,
          token: sanitizedToken,
          amount: amount * 1_000_000,
        },
      };

      const response = await api.submitTransfer(submitData).catch((e) => {
        console.info(e);
        const { message } = e;
        throw new Error(`${message}`);
      });

      if (response.sent) {
        // Reset form if successful
        setAmount(0);
        setError(undefined);
        setStatus(Status.Completed);
        // setStatusText("Faucet Successfully!");
        setStatusText(
          <div className="w-full bg-yellow-900 text-yellow border border-current rounded-md text-base py-4 flex justify-center">
            Faucet {amount === undefined || amount === 0 || amount > 20 ? "" : amount} NAAN Successfully!!! Please check your wallet.
          </div>)
        setResponseDetails(response);
        return;
      }

      setStatus(Status.Completed);
      // setStatusText("Faucet Failed!");
      setStatusText(
        <div className="w-full bg-neutral-800 text-red-500 border border-current rounded-md text-base py-4 flex justify-center">
          Faucet Failed!!! Please come back after 24 hours.
        </div>
      );
      console.info(response);
    } catch (e) {
      setError(`${e}`);
      setStatus(Status.Error);
    }
  }, [account, tokenAddress, amount]);

  const handleFocus = (e: React.ChangeEvent<HTMLInputElement>): void =>
    e.target.select();

  const logoNAMADA = 'https://namada.net/_next/static/media/namada-yellow.77693ede.gif'

  return (
    <FaucetFormContainer>

      <div className="flex justify-center items-center pb-3">
        <img src={logoNAMADA} width="330px" height="110px" alt="Namada Faucet" style={{}} />
      </div>
      
      {settingsError && <Alert type="error">{settingsError}</Alert>}
      <InputContainerAccount>
        {accounts.length > 0 ?
          <Select
            data={accountsSelectData}
            value={account.address}
            label="Your Wallet"
            onChange={(e) => setAccount(accountLookup[e.target.value])}
          />
        : <div>
            You have no signing accounts! Import or create an account in the namada wallet
            extension, then reload this page.
          </div>
        }
      </InputContainerAccount>

      {/* <InputContainerAccount>
        <Input
          label="Token Address (defaults to NAM)"
          value={tokenAddress}
          onFocus={handleFocus}
          onChange={(e) => setTokenAddress(e.target.value)}
        />
      </InputContainerAccount> */}

      <InputContainerAmount>
        <AmountInput
          placeholder={`Limit ${limit} NAAN`}
          label="Enter Amount"
          value={amount === undefined ? undefined : new BigNumber(amount)}
          min={1}
          maxDecimalPlaces={3}
          onFocus={handleFocus}
          onChange={(e) => setAmount(e.target.value?.toNumber())}
          error={
            amount && amount > limit ?
              `Amount must be less than or equal to ${limit} NAAN`
            : ""
          }
        />
      </InputContainerAmount>

      {status !== Status.Error && (
        <FormStatus>
          {status === Status.Pending && (
            <InfoContainer>
              <div className="text-yellow flex justify-center flex-start font-medium text-base pb-3">Please wait a few seconds, {amount === undefined || amount === 0 || amount > 20 ? "" : amount} NAAN is coming to your wallet...</div>
              <Alert type="warning">
                
                <LinearProgress style={{ height: '8px' }} color="success" />
              </Alert>
            </InfoContainer>
          )}
          {status === Status.Completed && (
            <InfoContainer>
              {/* <Alert type="info">{statusText}</Alert> */}
              {statusText}
            </InfoContainer>
          )}

          {responseDetails && responseDetails.sent && status !== Status.Pending && (
            <div className="flex flex-col justify-center items-center text-base pb-7">
              <a href={`https://namada-explorer-thanhphm-dev.uk/transaction/hash/detail/${responseDetails.tx_hash}`} className="underline text-blue-500 hover:text-yellow flex flex-1" target="_blank" rel="noopener noreferrer">
                <span className="underline italic text-blue-600 hover:text-white">Click To View Transaction Details</span>
              </a>
            </div>
          )}
  
        </FormStatus>
      )}
      {status === Status.Error && <Alert type="error">{error}</Alert>}

      <ButtonContainer>
        <ActionButton
          style={{
            fontSize: "1.25rem",
            lineHeight: "1.9",
            padding: "0.6em 2.5em",
            margin: 0,
          }}
          className={`max-w-fit ${!isFormValid && "opacity-50"}`}
          color="secondary"
          borderRadius="md"
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          Faucet {amount === undefined || amount === 0 || amount > 20 ? "" : amount} NAAN
        </ActionButton>
      </ButtonContainer>
    </FaucetFormContainer>
  );
};
