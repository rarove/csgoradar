#include "pch.hpp"

bool main()
{
    config_data_t config_data = {};
    INIT_STEP("config system", cfg::setup(config_data));
    INIT_STEP("memory", m_memory->setup());
    INIT_STEP("interfaces", i::setup());
    INIT_STEP("schema", schema::setup());

    ix::initNetSystem();
    LOG_INFO("winsock initialization completed");

    std::string ip = config_data.m_ip;
    ip.erase(0, ip.find_first_not_of(" \t\r\n"));
    ip.erase(ip.find_last_not_of(" \t\r\n")+1);
    std::string formatted_address;
    if (ip.rfind("ws://",0)==0 || ip.rfind("wss://",0)==0) formatted_address = ip;
    else if (ip.find("onrender.com")!=std::string::npos || ip.find("ngrok")!=std::string::npos) {
        if (ip.find("/cs2_webradar")!=std::string::npos) formatted_address = std::format("wss://{}", ip.starts_with("https://")?ip.substr(8):ip.starts_with("http://")?ip.substr(7):ip);
        else formatted_address = std::format("wss://{}/cs2_webradar", ip);
        if (formatted_address.rfind("wss://wss://",0)==0) formatted_address = formatted_address.substr(6);
        if (formatted_address.rfind("wss://ws://",0)==0) formatted_address = "wss://" + formatted_address.substr(9);
    } else formatted_address = std::format("ws://{}:22006/cs2_webradar", ip);

    static ix::WebSocket web_socket;
    std::mutex handshake_mutex;
    std::condition_variable handshake_cv;
    bool connected = false;
    bool failed = false;

    // Randomized initial delay to avoid fingerprinting on connect
    std::this_thread::sleep_for(std::chrono::milliseconds(50 + rand() % 100));

    web_socket.setUrl(formatted_address);
    web_socket.setPingInterval(25);
    web_socket.enableAutomaticReconnection(true);
    web_socket.setOnMessageCallback([&](const ix::WebSocketMessagePtr& msg)
    {
        if (msg->type == ix::WebSocketMessageType::Open)
        {
            {
                std::lock_guard lock(handshake_mutex);
                connected = true;
            }
            handshake_cv.notify_one();
            LOG_INFO("connected to the web socket ('%s')", formatted_address.c_str());
        }
        else if (msg->type == ix::WebSocketMessageType::Error)
        {
            {
                std::lock_guard lock(handshake_mutex);
                failed = true;
            }
            handshake_cv.notify_one();
            LOG_ERROR("failed to connect to the web socket ('%s')", formatted_address.c_str());
        }
        else if (msg->type == ix::WebSocketMessageType::Close)
        {
            LOG_INFO("web socket closed, will auto-reconnect");
        }
    });
    web_socket.start();

    {
        std::unique_lock lock(handshake_mutex);
        handshake_cv.wait(lock, [&] { return connected || failed; });
    }

    if (!connected)
    {
        std::this_thread::sleep_for(std::chrono::seconds(5));
        web_socket.stop();
        web_socket.start();
        std::this_thread::sleep_for(std::chrono::seconds(2));
    }

    for (;;)
    {
        if (web_socket.getReadyState() != ix::ReadyState::Open)
        {
            std::this_thread::sleep_for(std::chrono::milliseconds(1000));
            continue;
        }
        sdk::update();
        f::run();
        if (f::m_data.empty()) f::m_data["m_map"] = "invalid";
        auto res = web_socket.send(f::m_data.dump());
        if (!res.success)
        {
            LOG_WARNING("send failed, will retry");
        }

        const int jitter = 20;
        const auto delay = 100_ms + std::chrono::milliseconds(rand() % (jitter * 2) - jitter);
        std::this_thread::sleep_for(delay);
    }

    return true;
}